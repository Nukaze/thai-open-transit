# ADR 0002: View counter in an isolated Supabase project

| Field    | Value                                      |
| -------- | ------------------------------------------ |
| Status   | **Accepted**                               |
| Date     | 2026-10-18                                 |
| Deciders | Project owner                              |
| Scope    | Public site footer, a separate stats store |

## 1. Context

The owner wants a view counter ("12,345 views · 87 today") beside the footer
links, mostly as encouragement while the project is young.

[CLAUDE.md](../../CLAUDE.md) 2.4 keeps the public plane static: the public site
never talks to the database. Its stated reasons are that the site survives a
database outage, costs near zero, and has minimal attack surface. A counter
needs somewhere to record hits, so it cannot be fully static.

## 2. Decision

A **dedicated Supabase project used only for stats**, called directly from the
browser. It is never the dataset database. The rule this ADR sets: **anything
the public site writes to lives in its own project, never in the dataset
database.**

### 2.1 What is counted

- **Page views, not unique visitors.** Every load a person actually sees counts,
  reloads included (a reload is still interest).
- No `localStorage` dedupe, no visitor IDs, no cookies, no IPs stored.
- Counting fires once per page load, and only when the tab is visible.
  Background or prerendered tabs wait for `visibilitychange`. One shared promise
  per load covers React Strict Mode and panel remounts.

### 2.2 Storage

Table `visits(bucket timestamptz, lang, device, views)`, primary key
`(bucket, lang, device)`. See `db/stats/visit_counter.sql`.

| Column   | Values                                                                                                      |
| -------- | ----------------------------------------------------------------------------------------------------------- |
| `bucket` | 30-minute UTC bucket: `date_bin('30 minutes', now(), '2000-01-01Z')`                                        |
| `lang`   | `th`, `en`, `unknown`                                                                                       |
| `device` | `mobile`, `desktop`, `unknown` (viewport >= 768px is `desktop`)                                             |
| `views`  | Incremented on conflict. Table uses `fillfactor = 80` so the `views + 1` updates stay HOT (views unindexed) |

- `lang` and `device` are whitelisted inside the function; anything else is
  stored as `unknown`.
- Stored in UTC, displayed in Bangkok: "today" is the rows whose bucket falls on
  the Bangkok calendar day.
- The total is a sum on read. There is no separate total row, so there is a
  single source of truth and nothing to resync.

### 2.3 Access

- RLS on with no policies. The publishable key can only execute
  `record_view(p_lang, p_device)` and the read-only `get_stats()`.
- Config lives in `apps/web/lib/stats-config.json` (public URL and publishable
  key, both public by design). Empty means the counter is hidden, so the build
  needs no environment variables.
- `.github/workflows/stats-keepalive.yml` calls `get_stats()` Mon/Wed/Fri at
  10:00 Bangkok so the free project does not pause after a quiet week.

### 2.4 Bot filter

Two layers, deliberately loose:

| Layer   | Rule                                                                                                                                                                                                                                           |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Browser | Skip `record_view` when `navigator.webdriver` is set or the UA matches `bot/\|crawl\|spider\|slurp\|headless\|lighthouse` (`bot/` as a version token: CUBOT phones carry `bot` in the model name). Bots still see the numbers via `get_stats`. |
| SQL     | `record_view` ignores an empty UA or one matching crawler or HTTP-library words: `bot/`, `curl`, `wget`, `python`, `httpie`, `go-http`, `okhttp`, `axios`, `node-fetch`, `java/`.                                                              |

Crawling, SEO and AI indexing are unaffected: the filter only skips the counter
call.

Principle: stop simple and average bots, never risk dropping a real person. A
bot faking a browser UA still counts. That is accepted: the number is
decorative and the site is low-value to attackers.

### 2.5 No hourly cap

A real viral spike (for example a TikTok mention) must count in full, so there
is no per-hour cap. Revisit if spam appears (add a cap, or fix rows by hand).

## 3. Sizing

About 100 bytes per row including the index.

| Case      | Combos (lang x device) | Max rows/day | After 10 years | Free tier |
| --------- | ---------------------- | ------------ | -------------- | --------- |
| Realistic | 4                      | <= 192       | ~70 MB         | 500 MB    |
| Worst     | 9                      | <= 432       | ~160 MB        | 500 MB    |

The total sum takes roughly 50-100 ms at 10 years. If it ever matters, old
buckets can be rolled up to daily rows.

## 4. Why this does not break CLAUDE.md 2.4's reasons

| 2.4 reason             | How it holds                                                                                                          |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Survives a DB outage   | The counter renders nothing on any failure; the map never waits on it.                                                |
| Near-zero cost         | Supabase free tier; a few hundred tiny rows per day at most.                                                          |
| Minimal attack surface | **Isolation**: the stats project holds only counts and is never the dataset database. Spam can only inflate a number. |

## 5. Alternatives considered

| Option                                     | Why not                                                                                                                                      |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Cloudflare Worker + D1                     | Most robust (no pause), but a new platform; downtime is acceptable here.                                                                     |
| Vercel Function + Upstash                  | Breaks "no serverless functions in Phase 1" and "no Vercel-specific APIs".                                                                   |
| Neon                                       | Needs a function host in front; scale-to-zero fights constant small traffic.                                                                 |
| GoatCounter                                | Public counts are cached up to 4 hours.                                                                                                      |
| The Phase 2 dataset database               | Breaks isolation: a public write path into the real data.                                                                                    |
| Unique daily visitor via `localStorage`    | More code; views are enough.                                                                                                                 |
| Plausible-style daily-salt hash of IP + UA | Needs IP processing, salt rotation and a seen-hash table.                                                                                    |
| Fingerprinting                             | Invasive.                                                                                                                                    |
| 1-minute buckets                           | Grows with traffic, about 2 GB+ after 10 years.                                                                                              |
| 10-minute buckets                          | About 470 MB worst case after 10 years, near the limit.                                                                                      |
| Hourly buckets                             | Fine, but 30 minutes shows commute peaks and aligns with half-hour time zones.                                                               |
| Hourly cap                                 | Drops real viral spikes.                                                                                                                     |
| Cloudflare Turnstile for the counter       | Needs an Edge Function, a secret, a third-party script and two calls. Deferred to the Phase 2 admin and change-request forms, where it fits. |

## 6. Consequences

- The counter can disappear (paused project, outage, ad blockers). Accepted:
  it is decorative.
- Counts are approximate: bots faking a browser UA count, and tabs that only
  ever stay in the background do not.
- Site-level protection (a future Cloudflare) does **not** cover the counter,
  because spam can call the RPC directly on Supabase.
- GitHub disables scheduled workflows in a public repo after 60 days without
  repository activity; re-enable from the Actions tab if that happens.
- Supabase's terms on keep-alive pings are not documented either way; if the
  pings stop working, the project pauses and the counter hides.

## 7. Follow-up

When the domain is bought at Cloudflare, a new ADR moves hosting to Cloudflare
Pages + R2:

- `bangkok.pmtiles` is 53 MB, over Pages' 25 MiB per-file limit.
- Vercel Hobby allows about 100 GB/month of transfer with no paid overage, so a
  viral spike risks taking the site down.
- Cloudflare bot rules should allow verified bots, alongside `robots.txt` and
  `llms.txt`.

Putting Cloudflare in front of Vercel is rejected: Vercel advises against
reverse proxies (the firewall loses visibility, latency rises, certificate
errors).

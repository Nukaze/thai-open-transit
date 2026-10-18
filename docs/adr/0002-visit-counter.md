# ADR 0002: Visit counter in an isolated Supabase project

| Field    | Value                                      |
| -------- | ------------------------------------------ |
| Status   | **Accepted**                               |
| Date     | 2026-10-18                                 |
| Deciders | Project owner                              |
| Scope    | Public site footer, a separate stats store |

## 1. Context

The owner wants a visit counter ("12,345 visits · 87 today") beside the
footer links, mostly as encouragement while the project is young.

[CLAUDE.md](../../CLAUDE.md) 2.4 keeps the public plane static: the public site
never talks to the database. Its stated reasons are that the site survives a
database outage, costs near zero, and has minimal attack surface. A counter
needs somewhere to record hits, so it cannot be fully static.

## 2. Decision

A **dedicated Supabase project used only for stats**, called directly from the
browser:

- Table `visits_daily(day, count)`: one row per Bangkok calendar day. No IPs,
  user agents or anything personal.
- RLS on with no policies; the publishable key can only execute
  `record_visit()` (count one visit, return totals) and `get_stats()`
  (read-only). See `db/stats/visit_counter.sql`.
- A browser is counted once per Bangkok day (`localStorage`), later loads
  only read.
- The project URL and publishable key are public by design and live in
  `apps/web/lib/stats-config.json`. Empty means the counter is hidden, so the
  site still builds with no environment variables.
- `.github/workflows/stats-keepalive.yml` calls `get_stats()` Mon/Wed/Fri so
  the free project does not pause after a quiet week.

## 3. Why this does not break 2.4's reasons

| 2.4 reason             | How it holds                                                                                                          |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Survives a DB outage   | The counter renders nothing on any failure; the map never waits on it.                                                |
| Near-zero cost         | Supabase free tier; one tiny row per day.                                                                             |
| Minimal attack surface | **Isolation**: the stats project holds only counts and is never the dataset database. Spam can only inflate a number. |

The rule this ADR sets: **anything the public site writes to lives in its own
project, never in the dataset database.**

## 4. Alternatives considered

| Option                       | Why not                                                                      |
| ---------------------------- | ---------------------------------------------------------------------------- |
| Cloudflare Worker + D1       | Most robust (no pause), but a new platform; downtime is acceptable here.     |
| Vercel Function + Upstash    | Breaks "no serverless functions in Phase 1" and "no Vercel-specific APIs".   |
| Neon                         | Needs a function host in front; scale-to-zero fights constant small traffic. |
| GoatCounter public counter   | Public counts are cached up to 4 hours.                                      |
| The Phase 2 dataset database | Breaks isolation: a public write path into the real data.                    |

## 5. Consequences

- The counter can disappear (paused project, outage, ad blockers). Accepted:
  it is decorative.
- Counts are approximate: cleared storage or another browser counts again,
  and the endpoint can be spammed. Accepted for an encouragement metric.
- Supabase's terms on keep-alive pings are not documented either way; if the
  pings stop working, the project pauses and the counter hides.
- GitHub disables scheduled workflows in a public repo after 60 days without
  repository activity; re-enable from the Actions tab if that happens.

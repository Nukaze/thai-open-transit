# ADR 0001: Multi-region, multi-country and multi-mode

| Field    | Value                                                     |
| -------- | --------------------------------------------------------- |
| Status   | **Proposed**                                              |
| Date     | 2026-10-14                                                |
| Deciders | Project owner                                             |
| Scope    | Domain, URL scheme, data layout, schema, payload strategy |

This records a brainstorm, not a decision. Nothing here is implemented. Open
questions are listed in section 9 and must be closed before the status moves
to Accepted.

---

## 1. Context

The project today covers one metro area (Bangkok plus Nonthaburi, Samut
Prakan, Pathum Thani) and one family of modes (urban rail). The owner wants:

1. **More places.** Other cities and countries (Tokyo, Seoul, ...), for anyone
   travelling there, not only Thai users.
2. **More modes.** Intercity rail (SRT), airport rail, bus, boat/ferry.
3. **A shorter, place-neutral name and domain.** `bangkokopentransit` is long
   and ties the brand to one city.

The architectural rules in [CLAUDE.md](../../CLAUDE.md) still apply: dataset
first, bitemporal, static public plane, no history in the main payload,
performance budget, no hardcoded domain, portable off Vercel.

What the current code assumes (checked against `main` at `16c0a69`):

| Assumption                         | Where                                                         |
| ---------------------------------- | ------------------------------------------------------------- |
| One network, one payload           | `data/dist/network.json`                                      |
| Line id is `{OPERATOR}_{COLOR}`    | `packages/schema/src/line.ts` regex `^[A-Z]+_[A-Z]+$`         |
| No transport mode on `Line`        | `LineSchema` has no `mode` field                              |
| No region or country on any entity | `LineSchema`, `StationSchema`                                 |
| Station id is unscoped (`BL15`)    | `StationSchema.id`                                            |
| Base URL is a single constant      | `apps/web/lib/constants.ts` `PUBLIC_BASE_URL = ""` (relative) |
| Single route                       | `apps/web/app/page.tsx`                                       |

---

## 2. Domain

**Proposed:** `opentransit.dev`, registered at Cloudflare Registrar, hosted on
Vercel.

Availability and prices were checked on 2026-10-14 via the Vercel registrar
API. They change; re-check before buying.

| Candidate            | Year 1 | Renewal | Note                                          |
| -------------------- | ------ | ------- | --------------------------------------------- |
| `opentransit.dev`    | $9.99  | $13     | First choice. Reads "data / developers". HSTS |
| `opentransit.page`   | $11.99 | $11.99  | Best fallback. Also HSTS                      |
| `opentransit.fyi`    | $7     | $7      | Cheapest long term, informal tone             |
| `opentransit.earth`  | $19    | $19     | Global tone, pricier                          |
| `opentransit.world`  | $3.99  | $38.10  | Renewal trap, avoid                           |
| `opentransit.travel` | $29.99 | $129.47 | Renewal trap, avoid                           |

Taken on that date: `.com .org .io .app .net .co .xyz .tech .ai .so .us .eu
.de .live .city .info`.

Registrar comparison:

| Topic       | Vercel                        | Cloudflare                                    |
| ----------- | ----------------------------- | --------------------------------------------- |
| `.dev` cost | $9.99 then $13/yr             | ~$12.20/yr flat, at cost (third-party figure) |
| Setup       | One click, DNS auto-wired     | Manual CNAME to `cname.vercel-dns.com`        |
| Coupling    | Domain and host at one vendor | DNS independent of host                       |
| Extras      | none                          | R2 with zero egress, fits self-hosted PMTiles |

Five-year cost is about equal. Cloudflare is preferred for portability, which
CLAUDE.md requires. Gotchas: the Vercel record must be **DNS only** (grey
cloud), otherwise Vercel reports "Invalid Configuration" and cannot renew the
certificate; "Always Use HTTPS" or redirect rules can block the certificate
challenge; a new registration cannot be transferred for 60 days.

After purchase: add the domain to the Vercel project, 308-redirect
`bangkokopentransit.vercel.app`, set `PUBLIC_BASE_URL` only where an absolute
URL is truly needed (OG tags, sitemap), update CLAUDE.md and README naming.

---

## 3. URL scheme

```
opentransit.dev/bangkok
opentransit.dev/bangkok#14/13.7563/100.5018
                ^region  ^camera: zoom/lat/lon (MapLibre `hash` option)
```

- **Path = region, hash = camera.** The region must be a real path so that
  each one gets its own static HTML, `<title>`, OG image and search index
  entry. A hash is never sent to the server and is ignored by crawlers, so
  `opentransit.dev/#bangkok` is rejected. A hash is fine for the camera,
  which only matters after the page has loaded.
- **Flat slug, no country segment.** `/th/bangkok` is rejected: `th` is both
  the ISO 3166 country code for Thailand and the ISO 639 language code for
  Thai, and would collide with a future `/th/` locale path. The country is a
  field on the region, not part of the URL.
- **Slugs are globally unique.** Disambiguate with a country suffix only when
  needed (`san-jose-cr`).
- Rejected alternatives: `opentransit.bangkok.com` (we do not own
  `bangkok.com`), `bangkok.opentransit.dev` per-region subdomains (splits SEO
  authority, adds DNS and deploy work per region; can be added later as
  redirects to the path form).

---

## 4. Navigation behaviour

### 4.1 Entry: the slug sets the origin

Initial camera, highest priority first:

1. Camera in the hash, if present (a shared link means "show exactly this").
2. The region's default view, from the region record.
3. On `/`, see 4.3.

If the hash camera falls outside the slug's region, trust the hash and
`replaceState` the path to the region that contains it.

Each region page is generated with `generateStaticParams` and passes its
initial view to `Map` at build time, so MapLibre opens on the right place on
the first frame with no fly-to.

### 4.2 Panning updates the URL

- One `Map` instance lives in a layout shared by all region routes; changing
  region never re-creates it.
- On `moveend` (not every frame), test the map centre against region bboxes.
- When the region changes, call `history.replaceState` (not `pushState`), so
  panning does not fill the back stack. Use `pushState` only when the user
  explicitly picks a region from a menu.
- Hysteresis: the exit bbox is slightly larger than the entry bbox, so the
  URL does not flicker at a border.
- Lazy-load the new region's payload on entry; keep the old one cached.
- Zoomed out across several regions: keep the last slug, or go to `/`
  (open question).

Next.js App Router documents native `history.pushState/replaceState` as synced
with `usePathname`/`useSearchParams`. The feature was introduced behind the
`experimental.windowHistorySupport` flag; whether it is on by default in the
Next.js 16 used here must be verified before relying on it.

### 4.3 The root `/`

| Option | Behaviour                       | Trade-off                              |
| ------ | ------------------------------- | -------------------------------------- |
| A      | Region picker page              | Simple, good SEO, one extra click      |
| B      | Geolocate to the nearest region | Convenient, needs permission, needs A  |
| C      | Redirect to `/bangkok`          | Zero work today, looks Bangkok-centric |

Proposed: C while Bangkok is the only region, A when the second region lands,
with B as an opt-in button on A (reusing the existing geolocation control) so
the site never prompts for location on first load.

### 4.4 Regions with no data

The basemap is global, so any place can be shown. A slug for a place we have
no data for (`/paris`) should still work:

- A **gazetteer** maps slug to lat/lon/bbox and names. Candidate sources:
  GeoNames `cities15000` (about 25k places, CC-BY) or OSM. Trim to slug and
  coordinates and lazy-load it only when the slug is unknown, never in the
  first-load payload.
- Unknown slugs are **rewritten** to one shell page that reads the pathname
  client-side. Host support differs, which matters for the portability rule:

  | Host             | Mechanism                        |
  | ---------------- | -------------------------------- |
  | Vercel           | `rewrites`                       |
  | Cloudflare Pages | `_redirects` with status 200     |
  | GitHub Pages     | No rewrites; `404.html` as shell |

- The shell shows "no data for this place yet" with a link to contribute,
  and carries `noindex` so tens of thousands of empty pages are never indexed
  as thin content.

---

## 5. Country versus region

Neither level alone works:

| Only... | Breaks because                                                                                                           |
| ------- | ------------------------------------------------------------------------------------------------------------------------ |
| City    | Intercity rail, coaches and airport links belong to no single city; "Bangkok" already spans four provinces (CLAUDE.md 9) |
| Country | Payload too large (Japan has tens of thousands of stations); a Tokyo visitor does not need Hokkaido                      |

**Proposed: two levels with different jobs.**

| Level            | Job                                             | Examples                                          |
| ---------------- | ----------------------------------------------- | ------------------------------------------------- |
| **Country**      | Owns data: operators, sources, admins, id space | `th`: MRTA, SRT, DRT, BTSC. `jp`: JR, Tokyo Metro |
| **Metro region** | Views data: URL, camera, bbox, lazy-load unit   | `bangkok`, `chiangmai`, `tokyo`                   |

- A line belongs to exactly one country but may appear in several regions.
  SRT Northern Line is owned by `th` and shown in both `/bangkok` and
  `/chiangmai`. A region selects, it never owns.
- A region's bbox is **derived at build time from its stations' coordinates**,
  not typed by hand, so it grows when a line opens and there is no second
  value to keep in sync. Same for its default view.
- Cross-border lines (none in scope today) are owned by one country and noted
  in `source_refs`.

Sketch:

```
data/countries/th/lines/SRT_NORTHERN.json   owner: th
data/countries/th/stations/BL15.json
data/regions/bangkok.json                   { slug, country: "th", name_th, name_en }
data/dist/regions/bangkok/network.json      generated, per region
```

---

## 6. Schema changes this implies

All additive except the id namespace, which is why it must be decided before a
second country's data exists.

| Change                                                                          | Why                                              |
| ------------------------------------------------------------------------------- | ------------------------------------------------ |
| `Line.mode`, values aligned to GTFS `route_type` (metro, rail, bus, ferry, ...) | Multi-mode, GTFS export, per-mode payload split  |
| `Line.country`                                                                  | Ownership                                        |
| Relax the `{OPERATOR}_{COLOR}` line id regex                                    | Bus routes and ferries have numbers, not colours |
| Id namespace per country, or a `country` field plus uniqueness per country      | `BL15`-style codes may collide across countries  |
| `Region` entity: `slug`, `country`, names; bbox and default view derived        | URL and view unit                                |
| `code_history[].line` (already a known follow-up from PR #11)                   | Multi-code stations without prefix inference     |

Stable ids are forever (CLAUDE.md 5): whatever namespace is chosen, existing
Bangkok ids must stay valid, for example by treating unprefixed ids as `th`.

---

## 7. Payload and performance

Buses alone can add thousands of stops. To stay inside the budget
(`network.json` brotli < 120 KB, first load < 300 KB):

- One payload per region, and within a region optionally one per mode
  (rail first, bus on demand).
- Never one payload per country.
- History stays on the lazy endpoint (CLAUDE.md 2.5).

---

## 8. Interoperability

Publish a **GTFS** export per country or region. It is the format Google Maps,
Transitland and journey planners already read, and is the strongest way to
make the dataset useful outside this site. Schedules are out of scope; GTFS
static stops/routes/shapes are enough to start.

---

## 9. Open questions

1. Country versus region split as in section 5: accept, or a different unit?
2. Id namespacing: prefix (`th:BL15`) or a `country` field with per-country
   uniqueness?
3. Root `/`: confirm C now, A later.
4. Zoomed out across regions: keep last slug or return to `/`?
5. Is `windowHistorySupport` on by default in our Next.js 16?
6. Gazetteer source and licence (GeoNames CC-BY attribution vs OSM ODbL).
7. Domain: confirm `opentransit.dev` and Cloudflare, and whether to also hold
   `opentransit.page` as a redirect (about $25/yr for both).

---

## 10. Sources

- [Vercel docs: Cloudflare integration](https://vercel.com/docs/integrations/cloudflare)
- [Vercel Community: invalid configuration with Cloudflare proxy](https://community.vercel.com/t/invalid-configuration-error-when-cloudflare-proxy-enabled/38060)
- [domainoffer.net: Cloudflare .dev pricing](https://domainoffer.net/tld/dev/cloudflare)
- [Next.js docs: linking and navigating, native history API](https://docs.w3cub.com/nextjs/app/building-your-application/routing/linking-and-navigating)
- [Next.js PR #58335: pushState/replaceState support](https://git.devminer.xyz/archive/rsnext/commit/797fecb0c642be9db0d7586bcc54b4a2fe3b7653)

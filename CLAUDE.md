# CLAUDE.md

Context for AI coding agents working in this repository. Read this before writing code.

---

## 1. What this project is

**ThaiOpenTransit** is an open-source dataset and reference web application for
Bangkok's rail transit network, covering Bangkok and its metropolitan region
(Nonthaburi, Samut Prakan, Pathum Thani).

| Field               | Value                                          |
| ------------------- | ---------------------------------------------- |
| Product name        | Thai Open Transit (ThaiOpenTransit)            |
| GitHub repo         | `Nukaze/thai-open-transit`                     |
| GitHub org (future) | `opentransit-th`                               |
| Deployment          | Vercel, static export                          |
| URL                 | `thaiopentransit.vercel.app`                   |
| Custom domain       | Not yet purchased. Do not hardcode any domain  |
| Primary artifact    | **The dataset**, not the map                   |
| Map role            | Reference implementation / demo of the dataset |
| Commercial intent   | None. Public good, open source                 |

### Note on the name

The name says "transit", not "transit data", but the positioning is unchanged:
the dataset is the product. The name was chosen so the first public release
reads naturally to ordinary users. Do not let the name pull the architecture
toward a map-first design. Section 2.1 still governs.

"Thai" (renamed from BangkokOpenTransit) names the long-term scope, the whole
country under one brand; the dataset today still covers Bangkok and its
metropolitan region. New cities are added as data, not as new brands.

### The one-sentence positioning

> Nobody in Thailand publishes the rail network as a structured, versioned,
> temporally-aware open dataset. The map is how we prove the dataset is good.

If a design decision helps the map but hurts the dataset, the dataset wins.

---

## 2. Non-negotiable architectural rules

These are decisions already made. Do not re-litigate them in code review or
propose alternatives unless explicitly asked.

### 2.1 Data-first, never SVG-first

The source of truth is **structured JSON in a database**. SVG output is
_generated_ from that data at build time.

```
WRONG:  hand-drawn SVG  ->  website
RIGHT:  JSON/DB  ->  build step  ->  SVG + GeoJSON  ->  CDN  ->  website
```

Rationale: an SVG source of truth cannot be edited by non-developer admins,
cannot be queried, and cannot be time-travelled.

### 2.2 Bitemporal from day one

Two independent time axes. Do not conflate them.

| Axis             | Field                                   | Question it answers                 |
| ---------------- | --------------------------------------- | ----------------------------------- |
| Valid time       | `valid_from` / `valid_to` on the entity | "How many lines existed in 2004?"   |
| Transaction time | `entity_revisions` table                | "Who edited this record, and when?" |

Retrofitting valid time later requires a full migration and permanently loses
early history. It ships in v0.1 or never.

### 2.3 Revisions are append-only

`entity_revisions` has `ON UPDATE`/`ON DELETE` rules that discard writes.
A "revert" creates a _new_ revision whose content equals an older one. It never
deletes rows.

### 2.4 Public plane is static

The public site never talks to the database.

```
[Admin SPA] --auth--> [API] --> [Postgres]
                                    |
                             (Publish action)
                                    v
                          [Build: gen artifacts]
                                    v
                         [CDN static hosting]
```

Consequences: public site survives DB outage, costs near zero to host,
has minimal attack surface.

### 2.5 Never ship history in the main payload

`network.json` contains **current/queried state only**. Revision history is
fetched on demand from `/api/history/{id}`. The original inspiration for this
project (bangkoktransitmap.com) is slow on poor connections because it ships
one large monolithic file. Do not repeat that mistake.

### 2.6 Legal boundary

Do **not** copy, trace, fork, or "adapt" the SVG from bangkoktransitmap.com or
any other copyrighted transit map. That is a creative work with copyright.
All geometry must be derived from OpenStreetMap, MRTA/DRT/SRT published
documents, or produced originally by this project.

---

## 3. Tech stack

| Layer           | Choice                                  | Notes                        |
| --------------- | --------------------------------------- | ---------------------------- |
| Map rendering   | MapLibre GL JS                          | No vendor lock-in            |
| Basemap         | Protomaps (self-hosted PMTiles)         | Styleable, free              |
| Public frontend | SvelteKit or Next.js, **static export** | Must build to pure static    |
| Admin frontend  | SPA, separate deploy                    | `admin.` subdomain           |
| API             | Node/TypeScript (Hono or Fastify)       |                              |
| Database        | Postgres + PostGIS                      | Supabase acceptable          |
| Auth            | Supabase Auth or Auth.js                | Magic link, invite-only      |
| Authorization   | Postgres RLS                            | Enforced at DB, not just API |
| Schematic diff  | `jsondiffpatch`                         |                              |
| CI/CD           | GitHub Actions                          |                              |

### Package manager

Bun workspaces. This is a monorepo.

### Vercel deployment constraints

Phase 1 deploys `apps/web` to Vercel on the free tier.

| Rule                                                   | Reason                                                    |
| ------------------------------------------------------ | --------------------------------------------------------- |
| Build must produce a fully static output               | No serverless functions in Phase 1                        |
| No Vercel-specific APIs in app code                    | Must stay portable to Cloudflare Pages or GitHub Pages    |
| No environment variables required to build             | Anyone can clone and build locally                        |
| `vercel.json` sets long cache headers on hashed assets | See performance budget                                    |
| Never hardcode `thaiopentransit.vercel.app`            | Use relative URLs, or a single `PUBLIC_BASE_URL` constant |

The last rule matters: a custom domain will be added later, and hardcoded
absolute URLs are the most common thing that breaks in that migration.

---

## 4. Repository layout

```
thai-open-transit/
├── CLAUDE.md                    # this file
├── README.md
├── LICENSE-CODE                 # AGPL-3.0
├── LICENSE-DATA                 # ODbL-1.0
├── pnpm-workspace.yaml
│
├── docs/
│   ├── FEATURES.md              # goal + shipped feature list, keep current
│   ├── SPEC.md                  # feature spec, read this second
│   ├── GOVERNANCE.md            # admin roles, promotion, removal
│   ├── DATA_POLICY.md           # what sources are acceptable
│   ├── ADMIN_GUIDE.md           # for non-developer admins
│   ├── SECURITY.md
│   └── adr/                     # architecture decision records
│
├── packages/
│   ├── schema/                  # JSON Schema + TS types, SINGLE SOURCE OF TRUTH
│   │   ├── src/
│   │   │   ├── station.ts
│   │   │   ├── line.ts
│   │   │   ├── segment.ts
│   │   │   ├── milestone.ts
│   │   │   ├── revision.ts
│   │   │   └── index.ts
│   │   └── schemas/             # generated .json schema files
│   │
│   ├── geo-utils/               # projections, validators, ADM lookup
│   ├── network-graph/           # graph ops: routing, interchange resolution
│   ├── renderer/                # data -> SVG schematic generator
│   └── ui/                      # shared components, Thai typography
│
├── apps/
│   ├── web/                     # public static site
│   ├── admin/                   # admin SPA
│   └── api/                     # REST API
│
├── data/
│   ├── source/                  # raw imports, never hand-edited
│   ├── overrides/               # manual corrections, YAML, reviewed via PR
│   ├── layouts/                 # schematic coordinate sets per era
│   │   ├── 2026.json
│   │   └── 2030-plan.json
│   └── dist/                    # generated, gitignored except tagged releases
│       ├── network.json
│       ├── network.geojson
│       └── schematic.svg
│
├── db/
│   ├── migrations/
│   ├── policies/                # RLS policies
│   └── triggers/                # audit log triggers
│
└── scripts/
    ├── import/                  # OSM, MRTA, DRT importers
    ├── build/                   # artifact generation
    └── validate/                # schema + sanity checks
```

### Rules about this layout

- `packages/schema` is the single source of truth for all types. Everything
  else imports from it. Never redefine an entity shape locally.
- `data/source/` is write-once. Corrections go in `data/overrides/`, never by
  editing source files.
- `data/dist/` is generated. Never hand-edit. Never commit except on release tags.

---

## 5. Data conventions

### Entity IDs

Stable forever. Never reuse, never renumber.

| Entity            | Format                  | Example                     |
| ----------------- | ----------------------- | --------------------------- |
| Line              | `{OPERATOR}_{COLOR}`    | `MRT_BLUE`, `BTS_SUKHUMVIT` |
| Station           | `{LINE_PREFIX}{NUMBER}` | `BL15`, `N8`                |
| Interchange group | `{SLUG}`                | `MOCHIT_CHATUCHAK`          |
| Segment           | `{FROM}__{TO}`          | `BL15__BL16`                |

Station codes change over time (the Sukhumvit Line extension renumbered
stations). The **ID must not change** when the code does. Store code changes in
`code_history[]`.

### Naming fields

Every user-facing entity carries `name_th` and `name_en`. `name_en` may be null.
Never fall back to romanising `name_th` automatically at write time; do it at
render time if needed and mark it as derived.

### Mandatory provenance

Every mutation requires `source_refs`. A change request with an empty
`source_refs` array must fail validation at the API layer, not just in the UI.
This is the cheapest and most effective anti-misinformation control we have.

### Milestone events

Use these enum values. Do not invent new ones without an ADR.

```
construction_started | trial_run | opened | extended
renamed | recoded | suspended | closed
```

`trial_run` and `opened` are distinct and both matter in Thailand: lines
routinely run free trial service for weeks or months before commercial opening.

### Date precision

Sources disagree on Thai opening dates. Every date carries precision:

```
exact | month | year | disputed
```

When `disputed`, `source_refs` must contain more than one entry.

---

## 6. Code conventions

| Topic        | Rule                                                           |
| ------------ | -------------------------------------------------------------- |
| Language     | TypeScript, strict mode, no `any`                              |
| Formatting   | Prettier, default config, enforced in CI                       |
| Commits      | Conventional Commits (`feat:`, `fix:`, `data:`, `docs:`)       |
| Data changes | Use the `data:` commit type, never mix with code changes       |
| Tests        | Vitest. Graph and temporal logic require tests; UI does not    |
| Comments     | Explain _why_, not _what_. Thai comments acceptable in `data/` |
| Timezone     | Store UTC, display Asia/Bangkok                                |
| Coordinates  | WGS84 (EPSG:4326) everywhere internally                        |

### Testing priorities

Write tests for these. Everything else is optional.

1. Temporal queries: `as_of` filtering returns the correct network for a date
2. Graph integrity: no orphan stations, no dangling segments, interchange
   groups resolve
3. Revision immutability: update/delete on `entity_revisions` is a no-op
4. Four-eyes rule: `submitted_by != approved_by` is enforced
5. Reprojection: THAI-W75 to WGS84 round-trips within tolerance

---

## 7. Performance budget

Enforced in CI. Fail the build if exceeded.

| Metric                  | Budget   |
| ----------------------- | -------- |
| First load, compressed  | < 300 KB |
| `network.json`, brotli  | < 120 KB |
| LCP on simulated 3G     | < 2.5 s  |
| Thai font subset        | < 80 KB  |
| Time to interactive map | < 3.5 s  |

Thai font subsetting is the most commonly missed win. Subset to used glyphs.

---

## 8. Current phase

**Phase 1: public read-only site.** Build the map that reads a committed JSON
file. No database, no admin, no API.

Do not build the admin plane yet. It is roughly 2 to 3 times the effort of the
public site, and building it before anyone uses the map risks investing in a
maintenance system for a project with no users.

But: **the schema must already be bitemporal and revision-shaped** so the admin
plane can be added later without migration.

See `docs/SPEC.md` for the full phase breakdown.

---

## 9. Common pitfalls in this codebase

| Pitfall                                                      | Correct approach                                     |
| ------------------------------------------------------------ | ---------------------------------------------------- |
| Treating "publication snapshot" as the time-travel mechanism | Time travel uses `valid_from`/`valid_to` on entities |
| Using one schematic layout for all eras                      | Layouts are versioned; MVP uses geo mode for history |
| Storing `status` as an editable field                        | Derive `status` from `milestones[]`                  |
| Loading all revisions with the network                       | History is a separate lazy endpoint                  |
| Assuming station code == station ID                          | They are different and diverge over time             |
| Assuming the network is inside Bangkok province              | It spans four provinces                              |
| Enforcing RBAC only in API code                              | Enforce in Postgres RLS                              |

# Phase 1 Architecture Design - BangkokOpenTransit

Status: Approved for planning
Date: 2026-08-29
Scope: Phase 1 (public read-only map) per `CLAUDE.md` section 8 and `SPEC.md` section 4.

Read `CLAUDE.md` and `SPEC.md` first. This document resolves the open
implementation decisions needed to turn Phase 1 into a concrete build plan. It
does not re-litigate anything already decided in those two files.

---

## 1. Decisions locked in this design

| Decision | Choice | Why |
|---|---|---|
| Public frontend framework | Next.js, `output: 'export'` | Static export per CLAUDE.md 3; Vercel-native tooling |
| Package manager | **Bun workspaces** (supersedes CLAUDE.md 3's "pnpm workspaces") | Native workspace support, zero-config on Vercel. CLAUDE.md must be updated - see task list, item 1 |
| Data scope for Phase 1 | **Current (2026) + planned/under_construction only.** No 1999-2026 historical backfill | Historical time travel is a Phase 2 P0 feature, not Phase 1. Historical sourcing is a tens-of-hours research task (SPEC.md section 8) that must not block shipping. Schema stays bitemporal-shaped so history can be added later without migration (CLAUDE.md 2.2) |
| Monorepo package scope | All 5 packages built now: `schema`, `geo-utils`, `network-graph`, `renderer`, `ui` | `renderer` is needed for the Phase 1 P1 schematic-mode toggle (SPEC 1.7); `network-graph` is needed for interchange resolution used by both map and schematic renderer |
| Basemap hosting | Protomaps regional (Bangkok metro only, not national/planet) PMTiles extract, committed to repo, served as a static asset from Vercel | Regional extract is small (tens of MB, not the 30-50GB+ national/continental extracts); keeps "no env vars to build" rule (CLAUDE.md 3) intact; avoids an external storage dependency for Phase 1 |
| Reference added | `sanjorn.com/studio/bangkok-transit-map` added to SPEC.md section 6, same copyright exclusion as bangkoktransitmap.com (same author, © Oran Viriyincy, no license) | Historical narrative cross-check only, never geometry/design source |

---

## 2. Architecture

```
apps/web (Next.js, output:'export')
  reads data/dist/network.json + network.geojson + schematic.svg (committed at build/release time)
  reads public/basemap/bangkok.pmtiles (regional Protomaps extract, committed)

packages/schema        <- TS types + JSON Schema, single source of truth (station, line, segment,
                           milestone, revision, layout). Bitemporal shape present even though Phase 1
                           populates only current + planned data.
packages/geo-utils      <- projections, WGS84 validators, Thai grid reprojection
packages/network-graph  <- interchange resolution, segment adjacency, as_of graph queries
packages/renderer       <- schema+layout -> SVG schematic generator (build-time only, current era)
packages/ui             <- shared components, subset Thai font (<80KB budget)

data/source    <- write-once raw imports (OSM extracts, MRTA/DRT/SRT/BMA published plans)
data/overrides <- YAML manual corrections, PR-reviewed
data/layouts   <- 2026.json (current era) + 2030-plan.json (planned/master-plan layout).
                  No 1999/2016 layout files in Phase 1.
data/dist      <- generated network.json/geojson/schematic.svg (gitignored except release tags)

db/  <- migrations/policies/triggers WRITTEN NOW but not connected to anything running.
        Phase 1 has no live Postgres. This is schema-as-code staged for Phase 3, checked in inert,
        so the admin plane can be added later without a schema migration (CLAUDE.md 2.2, section 8).

scripts/import   <- OSM extraction (osmium/Overpass) for BTS/MRT/SRT/ARL/monorail line relations,
                    current + planned/under_construction only
scripts/build    <- data/source + data/overrides + data/layouts -> data/dist (no DB read in Phase 1)
scripts/validate <- JSON Schema validation, graph integrity, performance budget checks
```

### Why `db/` exists but is inert in Phase 1

CLAUDE.md 2.1 says the source of truth is "structured JSON in a database," and
2.4 draws the public/admin boundary through Postgres. But CLAUDE.md 8 is
explicit: Phase 1 has no database, no admin, no API. The resolution: for
Phase 1, git-reviewed files under `data/source` + `data/overrides` stand in
for the database. `scripts/build` reads those directly. This satisfies 2.1's
actual intent (no hand-edited SVG, no untracked corrections) without standing
up Postgres early. `db/migrations` gets written now, against the same
`packages/schema` types, so Phase 3 is a "point Postgres at this schema"
task, not a redesign.

---

## 3. Data flow

```
data/source (raw, write-once)
  + data/overrides (corrections, YAML, PR-reviewed)
  + data/layouts (2026.json, 2030-plan.json)
  -> scripts/build
  -> data/dist/{network.json, network.geojson, schematic.svg}
  -> committed on release tag
  -> Next.js build reads data/dist at build time
  -> static HTML/JS/PMTiles
  -> Vercel
```

`as_of` filtering (SPEC 2.1, built now since the schema is already bitemporal
per CLAUDE.md 2.2, even though Phase 1 only ships current+planned content):
pure client-side filter over `network.json`'s `validity[]`/`milestones[]`
arrays. No server involved, per CLAUDE.md 2.4/2.5.

---

## 4. Data scope detail

Phase 1 populates, per line/station:
- Current operational status (`operational`, `trial`, `suspended` where applicable)
- `under_construction`, `approved`, `planned` entries from the current M-Map2
  master plan (SRT/MRTA/BMA published documents)
- `code_history[]` only where a station's code has already changed under the
  *current* network (e.g. Sukhumvit Line renumbering) - this is present-day
  fact, not historical backfill
- `last_verified_at` set honestly per entity at time of import

Explicitly deferred (not built in Phase 1, no stub data fabricated):
- Any milestone dated before whatever the earliest "current" opening context
  requires (e.g. no synthetic 1999/2019 milestone entries invented to make a
  slider look populated)
- `data/layouts/1999.json`, `2016.json` - not created
- SPEC 2.1-2.7 (time travel UI) - schema supports it, no UI built for it yet

This means the year slider / era buttons (SPEC 1.7, 2.2-2.6) are Phase 2
work and are out of scope here even though the underlying schema already
supports them.

---

## 5. Testing (per CLAUDE.md 6 priority list)

Vitest across `packages/network-graph`, `packages/geo-utils`, `packages/schema`:
1. `as_of` filtering returns correct network for a given date (tested against
   current+planned data, since that's all that exists in Phase 1)
2. Graph integrity: no orphan stations, no dangling segments, interchange
   groups resolve
3. Reprojection round-trip tolerance (Thai grid <-> WGS84)

Revision immutability and four-eyes-rule tests are written against `db/`
schema/triggers directly (SQL-level tests), since no live API exists yet to
exercise them end-to-end. They validate the Phase 3 schema now, cheaply.

UI is untested per CLAUDE.md 6 convention. `scripts/validate` enforces
`source_refs` non-empty and JSON Schema conformance in CI.

---

## 6. CI (GitHub Actions)

```
lint + typecheck + vitest
  -> scripts/build (regenerate dist artifacts from committed source)
  -> scripts/validate (schema, graph integrity, perf budget)
  -> Next.js build (output: 'export')
  -> deploy preview (Vercel)
```

Perf budget gate (CLAUDE.md 7): first load <300KB compressed, `network.json`
brotli <120KB, Thai font subset <80KB. Fails the build if exceeded.

---

## 7. Task list to open with (feeds into the implementation plan)

1. Update CLAUDE.md section 3: "pnpm workspaces" -> "Bun workspaces" (doc
   correction to match this design's locked decision, done as the first
   commit so no stale conflicting instruction ships)
2. Scaffold monorepo: Bun workspaces, `packages/*` skeletons, `apps/web`,
   `db/` (inert), `scripts/*`
3. `packages/schema`: TS types + generated JSON Schema for all 6 core
   entities (station, line, segment, milestone, revision, layout)
4. `packages/geo-utils`, `packages/network-graph`, `packages/renderer`,
   `packages/ui`: build with tests per section 5
5. `scripts/import`: OSM extraction for current + planned lines only
6. Seed `data/source` with a small, honestly-sourced initial set (start with
   the best-documented lines) rather than fabricating placeholder data
7. `scripts/build` + `scripts/validate`
8. `apps/web`: MapLibre + Protomaps PMTiles, clustering, station panel, line
   filter, planned/under-construction rendering, search, deep links, i18n,
   report-error button, dataset download page (SPEC 1.1-1.13, minus 1.7/1.9
   time-travel-adjacent pieces that depend on historical data)
9. CI wiring per section 6

---

## 8. Open items carried forward (not blocking Phase 1 start)

- Historical backfill (1999-2026) - explicitly deferred, own future workstream
- `THAI-W75` reprojection target in CLAUDE.md's testing priority list needs
  confirming against an authoritative EPSG code before `geo-utils` implements
  it (flagged, not resolved here - verify at implementation time, don't guess
  a code)
- SPEC.md section 9 open questions (SRT inclusion, BRT/boat classification,
  "opened" definition, interchange fare model) - none block Phase 1 scaffold,
  but SRT/BRT inclusion affects which OSM relations `scripts/import` targets,
  so should be resolved before step 5 above, not after

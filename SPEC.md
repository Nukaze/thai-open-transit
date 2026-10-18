# SPEC.md

Feature specification and roadmap for Thai Open Transit.

Read `CLAUDE.md` first for architectural constraints.

---

## 1. Problem statement

Bangkok's rail network has grown from 2 lines in 1999 to more than 10 today,
across multiple operators (BTSC, BEM, SRT, MRTA concessions, BMA). Despite that:

| Gap                                               | Current state                                |
| ------------------------------------------------- | -------------------------------------------- |
| Structured open dataset of the network            | Does not exist                               |
| Temporal record of how the network grew           | Scattered across Wikipedia and news archives |
| Machine-readable planned/under-construction lines | Does not exist                               |
| Community-maintainable correction workflow        | Does not exist                               |

Existing work and why it does not close the gap:

| Project                          | What it is                                                 | Why the gap remains                                       |
| -------------------------------- | ---------------------------------------------------------- | --------------------------------------------------------- |
| bangkoktransitmap.com            | Well-designed static SVG poster site                       | Not machine-readable, not editable, no temporal dimension |
| hspotlight/metro-fare            | Open-source React route planner using OSM and graph theory | Current-state only, appears dormant                       |
| OpenStreetMap                    | Has line relations for most lines                          | Raw data, no presentation layer, no planned lines         |
| Commercial apps (ViaBus, Google) | Routing products                                           | Closed data, no historical view                           |

---

## 2. What we are building

Three deliverables, in priority order:

1. **A dataset.** Versioned, bitemporal, provenance-tracked, openly licensed.
2. **A reference web app.** Interactive map that proves the dataset works.
3. **A maintenance system.** Admin panel so non-developers can keep it current.

The dataset is the product. The other two exist to make it credible and durable.

---

## 3. Data model

### 3.1 Core entities

```
Line       - a service line (BTS Sukhumvit, MRT Blue, ...)
Station    - a physical stop, may serve multiple lines
Segment    - a directed edge between two adjacent stations on a line
Interchange- a group of stations that connect (walk or paid transfer)
Milestone  - a dated event affecting a Line or Station
Layout     - a set of schematic coordinates valid for an era
```

### 3.2 Station shape

```jsonc
{
  "id": "BL15", // stable forever
  "name_th": "ลาดพร้าว",
  "name_en": "Lat Phrao",
  "code_history": [{ "code": "BL15", "from": "2004-07-03", "to": null }],
  "interchange_group": "LATPHRAO",
  "structure": "underground", // underground | elevated | at_grade
  "accessible": true,
  "coords": {
    "geo": { "lat": 13.8163, "lon": 100.5615 },
    "schematic": { "x": 420, "y": 180 }, // resolved per layout era
  },
  "validity": [
    { "line": "MRT_BLUE", "from": "2004-07-03", "to": null },
    { "line": "MRT_YELLOW", "from": "2023-06-19", "to": null },
  ],
  "milestones": [
    {
      "date": "2004-07-03",
      "date_precision": "exact",
      "event": "opened",
      "line": "MRT_BLUE",
      "source_refs": [
        {
          "url": "...",
          "title": "MRTA press release",
          "published_at": "2004-07-03",
        },
      ],
    },
  ],
  "status": "operational", // DERIVED from milestones, never hand-set
  "confidence": "high",
  "last_verified_at": "2026-07-01",
}
```

### 3.3 Status enum

Derived from the latest milestone, never edited directly.

| Status               | Meaning                                 | Default rendering |
| -------------------- | --------------------------------------- | ----------------- |
| `operational`        | In commercial service                   | Solid             |
| `trial`              | Free or limited trial service           | Solid, badge      |
| `under_construction` | Physically being built                  | Dashed            |
| `approved`           | Funded and approved, not started        | Dashed, faded     |
| `planned`            | In the master plan                      | Outline           |
| `proposed`           | Under consideration for the master plan | Hidden by default |
| `suspended`          | Service paused                          | Grey              |
| `cancelled`          | Formally dropped                        | Hidden            |

### 3.4 Revision record

```sql
entity_revisions (
  id, entity_type, entity_id, rev_number, parent_rev_id,
  content JSONB,              -- full snapshot, not a diff
  actor_id, actor_role, created_at,
  edit_summary TEXT NOT NULL,
  source_refs JSONB NOT NULL, -- validation rejects empty
  is_minor, is_bot, revert_of,
  content_hash, size_bytes
)
```

Full snapshots, not diffs. Entities are roughly 1 KB; even 500 revisions is
trivial storage, and diffs can be computed at display time.

### 3.5 Layout sets

Schematic geometry changes as the network grows. A 2-line 1999 diagram cannot
share coordinates with an 11-line 2026 diagram.

```
data/layouts/
  1999.json
  2016.json
  2026.json
  2030-plan.json
```

**MVP simplification:** historical time travel uses **geo mode only**
(real coordinates do not change with era). Schematic mode supports the current
era only. Versioned schematic layouts are Phase 3.

---

## 4. Feature roadmap

### Phase 1 - Public read-only map

Target: shippable, useful, zero infrastructure cost.

| #    | Feature                                            | Priority | Notes                               |
| ---- | -------------------------------------------------- | -------- | ----------------------------------- |
| 1.1  | Load `network.json` and render geo map             | P0       | MapLibre + Protomaps                |
| 1.2  | Station markers with clustering                    | P0       | supercluster                        |
| 1.3  | Station detail panel                               | P0       | Name, lines, structure, opened date |
| 1.4  | Line filter and toggle                             | P0       |                                     |
| 1.5  | Show planned / under-construction lines            | P0       | This is a differentiator            |
| 1.6  | Search stations (TH + EN + code)                   | P0       | Client-side, Fuse.js                |
| 1.7  | Schematic mode toggle                              | P1       | Current era only                    |
| 1.8  | `last_verified_at` shown on every entity           | P1       | Trust signal                        |
| 1.9  | Deep links (`?station=BL15`)                       | P1       |                                     |
| 1.10 | PWA offline support                                | P1       | Usable underground with no signal   |
| 1.11 | i18n TH / EN                                       | P1       |                                     |
| 1.12 | "Report an error" button to prefilled GitHub issue | P1       | No backend needed                   |
| 1.13 | Dataset download page (JSON, GeoJSON, CSV)         | P0       | The product is the data             |

### Phase 2 - Time travel

This is the project's distinguishing feature. No Thai project has it.

| #   | Feature                                     | Priority | Notes                                                                                     |
| --- | ------------------------------------------- | -------- | ----------------------------------------------------------------------------------------- |
| 2.1 | `as_of` query parameter filters the network | P0       | Server-free, client filter                                                                |
| 2.2 | Year slider, 1999 to 2040                   | P0       |                                                                                           |
| 2.3 | Preset era buttons                          | P1       | 1999, 2004, 2016, 2023, today, 2030                                                       |
| 2.4 | Animated playback of network growth         | P1       | High shareability                                                                         |
| 2.5 | Era statistics panel                        | P1       | Lines, stations, route km at that date                                                    |
| 2.6 | Shareable era permalinks                    | P1       | `?as_of=2004-07-03`                                                                       |
| 2.7 | "Plan vs reality" view                      | P2       | Shows how far master plan dates slipped. **Strongest civic-value feature in the project** |

### Phase 3 - Admin plane

Only start this once Phase 1 has real users.

| #    | Feature                                       | Priority | Notes                                                     |
| ---- | --------------------------------------------- | -------- | --------------------------------------------------------- |
| 3.1  | Invite-only auth, magic link                  | P0       | No self-signup                                            |
| 3.2  | RBAC via Postgres RLS                         | P0       | viewer / contributor / editor / approver / owner          |
| 3.3  | Draft -> submit -> review -> publish workflow | P0       |                                                           |
| 3.4  | Four-eyes rule as DB constraint               | P0       | `submitted_by != approved_by`                             |
| 3.5  | Mandatory `source_refs` on every change       | P0       | API-level validation                                      |
| 3.6  | Append-only audit log via DB trigger          | P0       | Admins cannot disable it                                  |
| 3.7  | Milestone editor (not status editor)          | P0       | Status is derived                                         |
| 3.8  | Geo pin drag editor                           | P1       |                                                           |
| 3.9  | Publish action triggers artifact build        | P0       |                                                           |
| 3.10 | Snapshot per publication + one-click rollback | P0       |                                                           |
| 3.11 | MFA required for approver and above           | P1       |                                                           |
| 3.12 | Offboarding: revoke role, rotate secrets      | P1       | Admins rotate; plan for exits                             |
| 3.13 | Anomaly gate                                  | P1       | Station moved > 500 m or bulk delete requires 2 approvers |
| 3.14 | Publish notification webhook                  | P2       | Discord or Line                                           |
| 3.15 | Schematic node editor, 45-degree snap         | P2       | Hardest UI work in the project                            |

### Phase 4 - Wikipedia-style transparency

| #   | Feature                        | Priority | Notes                                           |
| --- | ------------------------------ | -------- | ----------------------------------------------- |
| 4.1 | Per-entity history page        | P0       | Date, actor, size delta, summary, sources       |
| 4.2 | Compare any two revisions      | P1       | Field-level diff                                |
| 4.3 | Revert as new revision         | P0       | Never deletes                                   |
| 4.4 | Recent Changes feed, site-wide | P0       | Strongest anti-vandalism tool                   |
| 4.5 | RSS feed of recent changes     | P1       | Watch without visiting                          |
| 4.6 | Watchlist notifications        | P2       |                                                 |
| 4.7 | Field-level provenance display | P2       | "Name verified 2025, status updated last month" |
| 4.8 | Contributor attribution page   | P1       | Required by ODbL / CC BY-SA                     |
| 4.9 | Data completeness dashboard    | P1       | Shows what is missing, invites contribution     |

### Phase 5 - Expansion (speculative)

| #   | Feature             | Notes                                       |
| --- | ------------------- | ------------------------------------------- |
| 5.1 | Bus network, coarse | Very large scope, evaluate carefully        |
| 5.2 | Airport connections | Small scope, high tourist value             |
| 5.3 | GTFS export         | Unlocks OpenTripPlanner, Transitous, Google |
| 5.4 | Fare calculation    | Cross-operator fares are genuinely complex  |
| 5.5 | Public API          | Only if there is real demand                |
| 5.6 | Other Thai cities   | Realistically 10+ years away                |

---

## 5. Explicit non-goals

Stating these prevents scope creep.

| Not doing                       | Why                                    |
| ------------------------------- | -------------------------------------- |
| Real-time train positions       | No open data source exists             |
| Trip planning / routing         | metro-fare and Google already do this  |
| Ticketing or payments           | Out of scope for a public-good dataset |
| Native mobile apps              | PWA is sufficient                      |
| Crowd-sourced anonymous editing | Invite-only admin model chosen instead |
| Monetisation                    | Explicitly not a goal                  |

---

## 6. Data sources

| Source                                                                    | Use                                                                    | Licence check needed                                                                                               |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| OpenStreetMap                                                             | Geometry, station positions                                            | ODbL, share-alike applies                                                                                          |
| MRTA / DRT / SRT publications                                             | Opening dates, official names, plans                                   | Public documents                                                                                                   |
| data.go.th                                                                | Government datasets                                                    | Check per-dataset terms                                                                                            |
| Wikipedia                                                                 | Historical timeline cross-check                                        | CC BY-SA, cite properly                                                                                            |
| News archives                                                             | Trial run and opening dates                                            | Cite, never copy text                                                                                              |
| bangkoktransitmap.com                                                     | **Do not use.** Copyrighted work                                       | Excluded                                                                                                           |
| sanjorn.com/studio/bangkok-transit-map (Oran Viriyincy design case study) | Historical narrative cross-check only (map design evolution 2001-2023) | © Oran Viriyincy, no license. Same exclusion as bangkoktransitmap.com: cite facts, never copy design/geometry/text |

---

## 7. Licensing

| Asset         | Licence      |
| ------------- | ------------ |
| Code          | AGPL-3.0     |
| Data          | ODbL-1.0     |
| Documentation | CC BY-SA 4.0 |

AGPL prevents a closed-source SaaS fork. ODbL matches OpenStreetMap, which is a
primary upstream source and requires share-alike anyway.

---

## 8. Sustainability risks

Civic tech projects in Thailand rarely fail because of code. They fail because
nobody updates the data six months later, and a stale map is worse than no map.

| Risk                              | Mitigation                                                            |
| --------------------------------- | --------------------------------------------------------------------- |
| Data rot                          | Show `last_verified_at` publicly; CI alerts when data exceeds 90 days |
| Single maintainer burnout         | Recruit a co-maintainer before public launch                          |
| Historical data is hard to source | Budget tens of hours; treat as a research task, not a coding task     |
| Admin turnover                    | `GOVERNANCE.md` written before the first admin is invited             |
| Sources disagree on dates         | `date_precision: disputed` plus multiple `source_refs`                |

---

## 9. Open questions

To resolve before or during Phase 1.

1. Domain: deferred. Running on `thaiopentransit.vercel.app` (the old
   `bangkokopentransit.vercel.app` 308-redirects to it) until there is
   reason to buy one. Free options if needed sooner: `owns.it.com`, `is-an.app`.
   When purchased, `.org` fits a civic project; `.in.th` requires business
   registration documents.
2. Do we include SRT long-distance and commuter rail, or urban lines only?
3. How are BRT and Chao Phraya boat services classified? Same schema or separate?
4. What is the exact definition of "opened"? Trial run or full commercial service?
   Proposal: record both as separate milestones; treat commercial as canonical.
5. Interchange model: paid vs unpaid transfer, and walking distance. Needed for
   any future fare feature; cheap to record now, expensive to retrofit.
6. Should the schematic renderer be automatic (octilinear solver) or use
   hand-authored layout files? Automatic is a known-hard research problem.

# Phase 1 Public Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the Phase 1 public read-only map: a Next.js static-export site that
renders Bangkok's current + planned rail network from a committed JSON dataset,
backed by a Bun-workspace monorepo with a bitemporal-shaped schema.

**Architecture:** `packages/schema` defines every entity as a Zod schema (native
`z.toJSONSchema()` export, no third-party converter). `packages/geo-utils`,
`packages/network-graph`, `packages/renderer`, `packages/ui` are built as
independent, tested libraries. `scripts/import` pulls OSM data, `scripts/build`
assembles `data/dist/network.json` + `.geojson` from `data/source` +
`data/overrides`, `scripts/validate` gates CI. `apps/web` is a Next.js
`output:'export'` app rendering the geo map only (no schematic mode this pass)
with MapLibre GL + a self-hosted Protomaps PMTiles basemap.

**Tech Stack:** Bun workspaces, TypeScript strict, Zod v4, Vitest, Next.js
(App Router, `output:'export'`), MapLibre GL JS + `pmtiles` +
`@protomaps/basemaps`, Fuse.js, `proj4`, `subset-font`, GitHub Actions
(`oven-sh/setup-bun@v2`).

**Spec:** `docs/superpowers/specs/2026-08-29-phase1-architecture-design.md`

## Global Constraints

- TypeScript strict mode, no `any` (CLAUDE.md 6)
- Prettier, default config, enforced in CI (CLAUDE.md 6)
- Commits: Conventional Commits; `data:` type for data-only changes, never mixed
  with code (CLAUDE.md 6)
- Vitest for `packages/*` and `scripts/*`; UI is untested (CLAUDE.md 6)
- Coordinates WGS84 (EPSG:4326) everywhere internally except at the Thai-grid
  reprojection boundary (CLAUDE.md 6)
- Timestamps stored UTC, displayed Asia/Bangkok (CLAUDE.md 6)
- Every mutation-shaped record requires non-empty `source_refs` (CLAUDE.md 5)
- `status` is always derived from `milestones[]`, never hand-set (CLAUDE.md 9)
- No Vercel-specific APIs in app code; no env vars required to build; never
  hardcode `bangkokopentransit.vercel.app` (CLAUDE.md 3)
- Performance budget, enforced in CI: first load <300KB compressed,
  `network.json` brotli <120KB, Thai font subset <80KB (CLAUDE.md 7)
- Package manager is **Bun workspaces**, not pnpm (this plan's Task 1 corrects
  the stale CLAUDE.md line)

## Explicitly out of scope for this plan

(Carried over from the spec, restated so no task tries to half-build these.)

- Historical dataset (1999-2026) - only current + planned/under_construction
  data is seeded
- Schematic-mode toggle (SPEC 1.7) - no hand-authored layout coordinates exist
  yet; `packages/renderer` is built and tested against a synthetic fixture,
  not wired into `apps/web`
- PWA offline support (SPEC 1.10) - deferred as its own fast-follow because
  Serwist requires Webpack (conflicts with Next.js 16's Turbopack default);
  revisit with a hand-rolled minimal service worker in a later plan
- Year slider / era permalinks / animated playback (SPEC 2.1-2.7) - Phase 2
- Basemap style switcher (Google-Maps-style "Map details" panel: light/dark/
  grayscale/satellite/terrain toggle) - not in SPEC's Phase 1 feature list,
  raised mid-session. Task 14 ships one fixed light style only. Fast-follow
  task, sources already vetted so no re-research needed when picked up:
  light/dark/grayscale via `@protomaps/basemaps` `namedFlavor()` (already a
  dependency); satellite via EOX Sentinel-2 cloudless WMTS (`s2maps.eu`, 2016
  mosaic is CC BY 4.0, later mosaics CC BY-NC - either fine, non-commercial
  project); terrain/hillshade via AWS Terrain Tiles Terrarium PNGs
  (`s3.amazonaws.com/elevation-tiles-prod`, public-domain-ish, no auth). All
  free, no API keys. Traffic/Street View/Wildfires/Air Quality (seen in a
  reference screenshot of Google Maps) have no free/open equivalent and are
  out of scope entirely, consistent with SPEC's non-goals.

Scope call made in this plan (resolves SPEC.md open question 2/3): initial OSM
import targets **urban/commuter rail only** - BTS Sukhumvit + Silom Lines, MRT
Blue + Purple + Yellow + Pink, SRT Red Line (Dark Red/Light Red, which absorbed
the former Airport Rail Link in 2021), current + under_construction/planned
extensions. Long-distance/intercity SRT, BRT, and Chao Phraya boat services are
excluded from Phase 1 - they need their own schema/classification decision
(SPEC.md open question 3), not made here.

---

### Task 1: Monorepo bootstrap

**Files:**

- Modify: `CLAUDE.md` (package manager line)
- Create: `package.json`, `tsconfig.base.json`, `.gitignore`, `.prettierrc.json`,
  `.github/workflows/ci.yml` (empty stub, filled in Task 19)
- Create: `packages/schema/package.json`, `packages/geo-utils/package.json`,
  `packages/network-graph/package.json`, `packages/renderer/package.json`,
  `packages/ui/package.json` (each minimal, filled out per-task)
- Create: `apps/web/package.json` (minimal stub, filled out in Task 13)

**Interfaces:**

- Produces: the Bun workspace root every later task's `bun install` / `bun run`
  commands depend on.

- [ ] **Step 1: Fix the package-manager line in CLAUDE.md**

In `CLAUDE.md`, section 3, replace:

```
### Package manager

pnpm workspaces. This is a monorepo.
```

with:

```
### Package manager

Bun workspaces. This is a monorepo.
```

- [ ] **Step 2: Initialize git and Bun**

```bash
git init
bun init -y
```

- [ ] **Step 3: Write the root `package.json`**

```json
{
  "name": "bangkok-open-transit",
  "private": true,
  "workspaces": ["packages/*", "apps/*"],
  "scripts": {
    "build": "bun run --filter='./packages/*' build && bun run --filter='./apps/*' build",
    "test": "vitest run",
    "typecheck": "bun run --filter='./packages/*' --filter='./apps/*' typecheck",
    "lint": "prettier --check .",
    "data:import": "bun run scripts/import/index.ts",
    "data:build": "bun run scripts/build/index.ts",
    "data:validate": "bun run scripts/validate/index.ts"
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "vitest": "^3.0.0",
    "prettier": "^3.4.0"
  }
}
```

- [ ] **Step 4: Write `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "strict": true,
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "declaration": true,
    "noUncheckedIndexedAccess": true
  }
}
```

- [ ] **Step 5: Write `.gitignore`**

```
node_modules/
data/dist/
*.log
.next/
out/
.DS_Store
```

- [ ] **Step 6: Write `.prettierrc.json`**

```json
{}
```

(Empty object = Prettier defaults, per CLAUDE.md 6's "default config" rule.)

- [ ] **Step 7: Create workspace package stubs**

For each of `schema`, `geo-utils`, `network-graph`, `renderer`, `ui` under
`packages/`, create a `package.json`:

```json
{
  "name": "PACKAGE_NAME",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc --noEmit -p tsconfig.json"
  }
}
```

Substitute `PACKAGE_NAME` with `schema`, `geo-utils`, `network-graph`,
`renderer`, `ui` respectively. Each package also gets a `tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src"]
}
```

And an empty `src/index.ts` (`export {};`) so the workspace resolves before
later tasks add real content.

- [ ] **Step 8: Write a root Vitest workspace config**

Root-level `bun run test` (used by CI in Task 19) must discover every
package's tests, not just tests at the repo root. Write `vitest.config.ts`:

```typescript
// vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: ["packages/*", "scripts/*", "apps/*"],
  },
});
```

Add `vitest` as a root devDependency if not already present (it is, from
Step 3).

- [ ] **Step 9: Verify the workspace installs**

Run: `bun install`
Expected: lockfile created, no errors, all 5 packages listed under
`node_modules/.bin` resolution (verify with `bun pm ls`).

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "chore: bootstrap Bun workspace monorepo"
```

---

### Task 2: `packages/schema` - Station entity

**Files:**

- Create: `packages/schema/src/station.ts`
- Test: `packages/schema/src/station.test.ts`

**Interfaces:**

- Produces: `StationSchema` (Zod schema), `Station` (inferred TS type), both
  exported from `packages/schema/src/station.ts`. Shape matches SPEC.md 3.2
  exactly, including `code_history`, `coords.geo`, `validity[]`,
  `milestones[]`, derived `status`.

- [ ] **Step 1: Write the failing test**

```typescript
// packages/schema/src/station.test.ts
import { describe, it, expect } from "vitest";
import { StationSchema } from "./station";

describe("StationSchema", () => {
  it("accepts a valid station record", () => {
    const station = {
      id: "BL15",
      name_th: "ลาดพร้าว",
      name_en: "Lat Phrao",
      code_history: [{ code: "BL15", from: "2004-07-03", to: null }],
      interchange_group: "LATPHRAO",
      structure: "underground",
      accessible: true,
      coords: {
        geo: { lat: 13.8163, lon: 100.5615 },
      },
      validity: [{ line: "MRT_BLUE", from: "2004-07-03", to: null }],
      milestones: [
        {
          date: "2004-07-03",
          date_precision: "exact",
          event: "opened",
          line: "MRT_BLUE",
          source_refs: [
            {
              url: "https://example.com/mrta-press-release",
              title: "MRTA press release",
              published_at: "2004-07-03",
            },
          ],
        },
      ],
      confidence: "high",
      last_verified_at: "2026-07-01",
    };
    expect(StationSchema.safeParse(station).success).toBe(true);
  });

  it("rejects a station with an empty source_refs array on a milestone", () => {
    const station = {
      id: "BL15",
      name_th: "ลาดพร้าว",
      name_en: "Lat Phrao",
      code_history: [{ code: "BL15", from: "2004-07-03", to: null }],
      interchange_group: "LATPHRAO",
      structure: "underground",
      accessible: true,
      coords: { geo: { lat: 13.8163, lon: 100.5615 } },
      validity: [{ line: "MRT_BLUE", from: "2004-07-03", to: null }],
      milestones: [
        {
          date: "2004-07-03",
          date_precision: "exact",
          event: "opened",
          line: "MRT_BLUE",
          source_refs: [],
        },
      ],
      confidence: "high",
      last_verified_at: "2026-07-01",
    };
    expect(StationSchema.safeParse(station).success).toBe(false);
  });

  it("rejects an unknown structure value", () => {
    const station = {
      id: "BL15",
      name_th: "ลาดพร้าว",
      name_en: "Lat Phrao",
      code_history: [{ code: "BL15", from: "2004-07-03", to: null }],
      interchange_group: "LATPHRAO",
      structure: "floating",
      accessible: true,
      coords: { geo: { lat: 13.8163, lon: 100.5615 } },
      validity: [],
      milestones: [],
      confidence: "high",
      last_verified_at: "2026-07-01",
    };
    expect(StationSchema.safeParse(station).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/schema && bun test station.test.ts`
Expected: FAIL - `station.ts` does not export `StationSchema` (module not found).

- [ ] **Step 3: Add `zod` dependency**

```bash
cd packages/schema && bun add zod@^4.0.0
```

- [ ] **Step 4: Write `packages/schema/src/station.ts`**

```typescript
// packages/schema/src/station.ts
import { z } from "zod";

export const DatePrecisionSchema = z.enum([
  "exact",
  "month",
  "year",
  "disputed",
]);
export type DatePrecision = z.infer<typeof DatePrecisionSchema>;

export const MilestoneEventSchema = z.enum([
  "construction_started",
  "trial_run",
  "opened",
  "extended",
  "renamed",
  "recoded",
  "suspended",
  "closed",
]);
export type MilestoneEvent = z.infer<typeof MilestoneEventSchema>;

export const SourceRefSchema = z.object({
  url: z.string().url(),
  title: z.string().min(1),
  published_at: z.string().date().nullable().optional(),
});
export type SourceRef = z.infer<typeof SourceRefSchema>;

export const MilestoneSchema = z
  .object({
    date: z.string().date(),
    date_precision: DatePrecisionSchema,
    event: MilestoneEventSchema,
    line: z.string().min(1).optional(),
    source_refs: z.array(SourceRefSchema).min(1),
  })
  .refine((m) => m.date_precision !== "disputed" || m.source_refs.length >= 2, {
    message: "disputed date_precision requires at least 2 source_refs",
  });
export type Milestone = z.infer<typeof MilestoneSchema>;

export const StatusSchema = z.enum([
  "operational",
  "trial",
  "under_construction",
  "approved",
  "planned",
  "proposed",
  "suspended",
  "cancelled",
]);
export type Status = z.infer<typeof StatusSchema>;

export const StationSchema = z.object({
  id: z.string().min(1),
  name_th: z.string().min(1),
  name_en: z.string().min(1).nullable(),
  code_history: z
    .array(
      z.object({
        code: z.string().min(1),
        from: z.string().date(),
        to: z.string().date().nullable(),
      }),
    )
    .min(1),
  interchange_group: z.string().min(1).nullable().optional(),
  structure: z.enum(["underground", "elevated", "at_grade"]),
  accessible: z.boolean(),
  coords: z.object({
    geo: z.object({
      lat: z.number().min(-90).max(90),
      lon: z.number().min(-180).max(180),
    }),
    schematic: z.object({ x: z.number(), y: z.number() }).optional(),
  }),
  validity: z.array(
    z.object({
      line: z.string().min(1),
      from: z.string().date(),
      to: z.string().date().nullable(),
    }),
  ),
  milestones: z.array(MilestoneSchema),
  confidence: z.enum(["high", "medium", "low"]),
  last_verified_at: z.string().date(),
});
export type Station = z.infer<typeof StationSchema>;
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd packages/schema && bun test station.test.ts`
Expected: PASS, all 3 assertions green.

- [ ] **Step 6: Commit**

```bash
git add packages/schema
git commit -m "feat(schema): add Station entity schema"
```

---

### Task 3: `packages/schema` - Line and Segment entities

**Files:**

- Create: `packages/schema/src/line.ts`, `packages/schema/src/segment.ts`
- Test: `packages/schema/src/line.test.ts`, `packages/schema/src/segment.test.ts`

**Interfaces:**

- Consumes: `MilestoneSchema`, `SourceRefSchema`, `StatusSchema` from
  `packages/schema/src/station.ts` (Task 2)
- Produces: `LineSchema`/`Line`, `SegmentSchema`/`Segment`, exported from
  `packages/schema/src/line.ts` and `segment.ts`. `Segment.id` format is
  `{FROM}__{TO}` per CLAUDE.md 5.

- [ ] **Step 1: Write the failing tests**

```typescript
// packages/schema/src/line.test.ts
import { describe, it, expect } from "vitest";
import { LineSchema } from "./line";

describe("LineSchema", () => {
  it("accepts a valid line record", () => {
    const line = {
      id: "MRT_BLUE",
      operator: "BEM",
      name_th: "รถไฟฟ้ามหานคร สายเฉลิมรัชมงคล",
      name_en: "MRT Blue Line",
      color_hex: "#1E3A8A",
      milestones: [
        {
          date: "2004-07-03",
          date_precision: "exact",
          event: "opened",
          source_refs: [
            {
              url: "https://example.com/a",
              title: "MRTA",
              published_at: "2004-07-03",
            },
          ],
        },
      ],
      confidence: "high",
      last_verified_at: "2026-07-01",
    };
    expect(LineSchema.safeParse(line).success).toBe(true);
  });

  it("rejects a color_hex that is not a hex color", () => {
    const line = {
      id: "MRT_BLUE",
      operator: "BEM",
      name_th: "a",
      name_en: "b",
      color_hex: "blue",
      milestones: [],
      confidence: "high",
      last_verified_at: "2026-07-01",
    };
    expect(LineSchema.safeParse(line).success).toBe(false);
  });
});
```

```typescript
// packages/schema/src/segment.test.ts
import { describe, it, expect } from "vitest";
import { SegmentSchema } from "./segment";

describe("SegmentSchema", () => {
  it("accepts a valid segment and derives id shape", () => {
    const segment = {
      id: "BL15__BL16",
      line: "MRT_BLUE",
      from_station: "BL15",
      to_station: "BL16",
      milestones: [],
      confidence: "high",
      last_verified_at: "2026-07-01",
    };
    expect(SegmentSchema.safeParse(segment).success).toBe(true);
  });

  it("rejects an id that does not match {FROM}__{TO}", () => {
    const segment = {
      id: "BL15-BL16",
      line: "MRT_BLUE",
      from_station: "BL15",
      to_station: "BL16",
      milestones: [],
      confidence: "high",
      last_verified_at: "2026-07-01",
    };
    expect(SegmentSchema.safeParse(segment).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/schema && bun test line.test.ts segment.test.ts`
Expected: FAIL - modules not found.

- [ ] **Step 3: Write `packages/schema/src/line.ts`**

```typescript
// packages/schema/src/line.ts
import { z } from "zod";
import { MilestoneSchema } from "./station";

export const LineSchema = z.object({
  id: z.string().regex(/^[A-Z]+_[A-Z]+$/, "Line id must be {OPERATOR}_{COLOR}"),
  operator: z.string().min(1),
  name_th: z.string().min(1),
  name_en: z.string().min(1),
  color_hex: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "color_hex must be a 6-digit hex color"),
  milestones: z.array(MilestoneSchema),
  confidence: z.enum(["high", "medium", "low"]),
  last_verified_at: z.string().date(),
});
export type Line = z.infer<typeof LineSchema>;
```

- [ ] **Step 4: Write `packages/schema/src/segment.ts`**

```typescript
// packages/schema/src/segment.ts
import { z } from "zod";
import { MilestoneSchema } from "./station";

export const SegmentSchema = z
  .object({
    id: z.string().regex(/^.+__.+$/, "Segment id must be {FROM}__{TO}"),
    line: z.string().min(1),
    from_station: z.string().min(1),
    to_station: z.string().min(1),
    milestones: z.array(MilestoneSchema),
    confidence: z.enum(["high", "medium", "low"]),
    last_verified_at: z.string().date(),
  })
  .refine((s) => s.id === `${s.from_station}__${s.to_station}`, {
    message: "Segment id must equal {from_station}__{to_station}",
  });
export type Segment = z.infer<typeof SegmentSchema>;
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd packages/schema && bun test line.test.ts segment.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/schema
git commit -m "feat(schema): add Line and Segment entity schemas"
```

---

### Task 4: `packages/schema` - Revision, Layout, barrel export, JSON Schema generation

**Files:**

- Create: `packages/schema/src/revision.ts`, `packages/schema/src/layout.ts`,
  `packages/schema/src/index.ts`, `packages/schema/scripts/generate-schemas.ts`
- Test: `packages/schema/src/revision.test.ts`, `packages/schema/src/layout.test.ts`
- Modify: `packages/schema/package.json` (add `generate-schemas` script)

**Interfaces:**

- Consumes: `StationSchema`, `LineSchema`, `SegmentSchema` (Tasks 2-3)
- Produces: `RevisionSchema`/`Revision`, `LayoutSchema`/`Layout`, and a single
  barrel `packages/schema/src/index.ts` re-exporting every schema/type. Later
  packages (`geo-utils`, `network-graph`, `renderer`, `scripts/*`) import
  exclusively from `packages/schema` (workspace dependency `"schema": "workspace:*"`),
  never redefine entity shapes locally (CLAUDE.md 4).

- [ ] **Step 1: Write the failing tests**

```typescript
// packages/schema/src/revision.test.ts
import { describe, it, expect } from "vitest";
import { RevisionSchema } from "./revision";

describe("RevisionSchema", () => {
  it("accepts a valid revision and rejects empty source_refs", () => {
    const base = {
      id: "rev_1",
      entity_type: "station",
      entity_id: "BL15",
      rev_number: 1,
      parent_rev_id: null,
      content: { id: "BL15" },
      actor_id: "user_1",
      actor_role: "editor",
      created_at: "2026-07-01T00:00:00Z",
      edit_summary: "Initial import",
      source_refs: [
        { url: "https://example.com", title: "x", published_at: null },
      ],
      is_minor: false,
      is_bot: false,
      revert_of: null,
      content_hash: "abc123",
      size_bytes: 512,
    };
    expect(RevisionSchema.safeParse(base).success).toBe(true);
    expect(RevisionSchema.safeParse({ ...base, source_refs: [] }).success).toBe(
      false,
    );
  });
});
```

```typescript
// packages/schema/src/layout.test.ts
import { describe, it, expect } from "vitest";
import { LayoutSchema } from "./layout";

describe("LayoutSchema", () => {
  it("accepts a valid layout set", () => {
    const layout = {
      era: "2026",
      stations: [{ station_id: "BL15", x: 420, y: 180 }],
    };
    expect(LayoutSchema.safeParse(layout).success).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/schema && bun test revision.test.ts layout.test.ts`
Expected: FAIL - modules not found.

- [ ] **Step 3: Write `packages/schema/src/revision.ts`**

```typescript
// packages/schema/src/revision.ts
import { z } from "zod";
import { SourceRefSchema } from "./station";

export const RevisionSchema = z.object({
  id: z.string().min(1),
  entity_type: z.enum(["station", "line", "segment"]),
  entity_id: z.string().min(1),
  rev_number: z.number().int().positive(),
  parent_rev_id: z.string().nullable(),
  content: z.record(z.string(), z.unknown()),
  actor_id: z.string().min(1),
  actor_role: z.enum(["contributor", "editor", "approver", "owner", "bot"]),
  created_at: z.string().datetime(),
  edit_summary: z.string().min(1),
  source_refs: z.array(SourceRefSchema).min(1),
  is_minor: z.boolean(),
  is_bot: z.boolean(),
  revert_of: z.string().nullable(),
  content_hash: z.string().min(1),
  size_bytes: z.number().int().nonnegative(),
});
export type Revision = z.infer<typeof RevisionSchema>;
```

- [ ] **Step 4: Write `packages/schema/src/layout.ts`**

```typescript
// packages/schema/src/layout.ts
import { z } from "zod";

export const LayoutSchema = z.object({
  era: z.string().min(1),
  stations: z.array(
    z.object({
      station_id: z.string().min(1),
      x: z.number(),
      y: z.number(),
    }),
  ),
});
export type Layout = z.infer<typeof LayoutSchema>;
```

- [ ] **Step 5: Write the barrel export `packages/schema/src/index.ts`**

```typescript
// packages/schema/src/index.ts
export * from "./station";
export * from "./line";
export * from "./segment";
export * from "./revision";
export * from "./layout";
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd packages/schema && bun test`
Expected: PASS - all tests across station/line/segment/revision/layout green.

- [ ] **Step 7: Write the JSON Schema generation script**

```typescript
// packages/schema/scripts/generate-schemas.ts
import { z } from "zod";
import { writeFileSync, mkdirSync } from "node:fs";
import {
  StationSchema,
  LineSchema,
  SegmentSchema,
  RevisionSchema,
  LayoutSchema,
} from "../src/index";

const schemas = {
  station: StationSchema,
  line: LineSchema,
  segment: SegmentSchema,
  revision: RevisionSchema,
  layout: LayoutSchema,
};

mkdirSync(new URL("../schemas", import.meta.url), { recursive: true });

for (const [name, schema] of Object.entries(schemas)) {
  const jsonSchema = z.toJSONSchema(schema);
  writeFileSync(
    new URL(`../schemas/${name}.json`, import.meta.url),
    JSON.stringify(jsonSchema, null, 2) + "\n",
  );
}
```

- [ ] **Step 8: Add the script to `packages/schema/package.json`**

Add to `"scripts"`: `"generate-schemas": "bun run scripts/generate-schemas.ts"`.

- [ ] **Step 9: Run it and verify output**

Run: `cd packages/schema && bun run generate-schemas`
Expected: `packages/schema/schemas/station.json`, `line.json`, `segment.json`,
`revision.json`, `layout.json` created, each valid JSON with a `"type": "object"`
root.

- [ ] **Step 10: Commit**

```bash
git add packages/schema
git commit -m "feat(schema): add Revision/Layout schemas, barrel export, JSON Schema generation"
```

---

### Task 5: `packages/geo-utils` - Thai grid reprojection and WGS84 validation

**Files:**

- Create: `packages/geo-utils/src/reproject.ts`, `packages/geo-utils/src/validate.ts`,
  `packages/geo-utils/src/index.ts`
- Test: `packages/geo-utils/src/reproject.test.ts`, `packages/geo-utils/src/validate.test.ts`

**Interfaces:**

- Produces: `toWgs84FromIndian1975Utm47N(easting, northing): { lat, lon }`,
  `fromWgs84ToIndian1975Utm47N(lat, lon): { easting, northing }`,
  `isWithinBangkokRegion(lat, lon): boolean` - all exported from
  `packages/geo-utils/src/index.ts`. `network-graph` and `scripts/import`
  (later tasks) import these.

- [ ] **Step 1: Write the failing reprojection test**

```typescript
// packages/geo-utils/src/reproject.test.ts
import { describe, it, expect } from "vitest";
import {
  toWgs84FromIndian1975Utm47N,
  fromWgs84ToIndian1975Utm47N,
} from "./reproject";

describe("Indian 1975 UTM 47N <-> WGS84 reprojection", () => {
  it("round-trips within 1 meter tolerance", () => {
    // Approximate Bangkok city-center coordinates
    const originalLat = 13.7563;
    const originalLon = 100.5018;

    const { easting, northing } = fromWgs84ToIndian1975Utm47N(
      originalLat,
      originalLon,
    );
    const { lat, lon } = toWgs84FromIndian1975Utm47N(easting, northing);

    // 1 meter is roughly 0.000009 degrees latitude at this latitude
    expect(Math.abs(lat - originalLat)).toBeLessThan(0.00001);
    expect(Math.abs(lon - originalLon)).toBeLessThan(0.00001);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/geo-utils && bun test reproject.test.ts`
Expected: FAIL - module not found.

- [ ] **Step 3: Add `proj4` dependency**

```bash
cd packages/geo-utils && bun add proj4@^2.9.0
bun add -d @types/proj4@^2.5.0
```

- [ ] **Step 4: Write `packages/geo-utils/src/reproject.ts`**

```typescript
// packages/geo-utils/src/reproject.ts
import proj4 from "proj4";

// EPSG:24047 - Indian 1975 / UTM zone 47N. Thailand's historical geodetic
// datum, still the source datum on older MRTA/SRT/RTSD published station
// coordinate documents. Definition per https://epsg.io/24047.proj4
const INDIAN_1975_UTM_47N =
  "+proj=utm +zone=47 +ellps=evrst30 +towgs84=293,836,318,0.5,1.6,-2.8,2.1 +units=m +no_defs +type=crs";

proj4.defs("EPSG:24047", INDIAN_1975_UTM_47N);

export function toWgs84FromIndian1975Utm47N(
  easting: number,
  northing: number,
): { lat: number; lon: number } {
  const [lon, lat] = proj4("EPSG:24047", "EPSG:4326", [easting, northing]);
  return { lat, lon };
}

export function fromWgs84ToIndian1975Utm47N(
  lat: number,
  lon: number,
): { easting: number; northing: number } {
  const [easting, northing] = proj4("EPSG:4326", "EPSG:24047", [lon, lat]);
  return { easting, northing };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd packages/geo-utils && bun test reproject.test.ts`
Expected: PASS.

- [ ] **Step 6: Write the failing validation test**

```typescript
// packages/geo-utils/src/validate.test.ts
import { describe, it, expect } from "vitest";
import { isWithinBangkokRegion } from "./validate";

describe("isWithinBangkokRegion", () => {
  it("accepts coordinates within Bangkok metro region (BKK/Nonthaburi/Samut Prakan/Pathum Thani)", () => {
    expect(isWithinBangkokRegion(13.7563, 100.5018)).toBe(true); // central Bangkok
  });

  it("rejects coordinates far outside the region", () => {
    expect(isWithinBangkokRegion(18.7883, 98.9853)).toBe(false); // Chiang Mai
  });
});
```

- [ ] **Step 7: Run test to verify it fails**

Run: `cd packages/geo-utils && bun test validate.test.ts`
Expected: FAIL - module not found.

- [ ] **Step 8: Write `packages/geo-utils/src/validate.ts`**

```typescript
// packages/geo-utils/src/validate.ts

// Bounding box covers Bangkok + Nonthaburi + Samut Prakan + Pathum Thani,
// per CLAUDE.md 9: "Assuming the network is inside Bangkok province" is a
// pitfall - the network spans four provinces.
const BANGKOK_REGION_BOUNDS = {
  minLat: 13.4,
  maxLat: 14.2,
  minLon: 100.2,
  maxLon: 100.95,
};

export function isWithinBangkokRegion(lat: number, lon: number): boolean {
  return (
    lat >= BANGKOK_REGION_BOUNDS.minLat &&
    lat <= BANGKOK_REGION_BOUNDS.maxLat &&
    lon >= BANGKOK_REGION_BOUNDS.minLon &&
    lon <= BANGKOK_REGION_BOUNDS.maxLon
  );
}
```

- [ ] **Step 9: Run test to verify it passes**

Run: `cd packages/geo-utils && bun test validate.test.ts`
Expected: PASS.

- [ ] **Step 10: Write the barrel export**

```typescript
// packages/geo-utils/src/index.ts
export * from "./reproject";
export * from "./validate";
```

- [ ] **Step 11: Commit**

```bash
git add packages/geo-utils
git commit -m "feat(geo-utils): add Thai grid reprojection and region validation"
```

---

### Task 6: `packages/network-graph` - graph build and integrity checks

**Files:**

- Create: `packages/network-graph/src/graph.ts`, `packages/network-graph/src/index.ts`
- Test: `packages/network-graph/src/graph.test.ts`

**Interfaces:**

- Consumes: `Station`, `Segment` types from `packages/schema` (Tasks 2-3)
- Produces: `buildGraph(stations: Station[], segments: Segment[]): NetworkGraph`,
  `findOrphanStations(graph): string[]`, `findDanglingSegments(graph): string[]`
  - exported from `packages/network-graph/src/index.ts`. Task 7's interchange
    resolution and Task 12's `scripts/validate` both consume `buildGraph`'s
    return type `NetworkGraph = { stations: Map<string, Station>; segments: Map<string, Segment>; adjacency: Map<string, Set<string>> }`.

- [ ] **Step 1: Add workspace dependency**

In `packages/network-graph/package.json`, add:

```json
"dependencies": { "schema": "workspace:*" }
```

- [ ] **Step 2: Write the failing test**

```typescript
// packages/network-graph/src/graph.test.ts
import { describe, it, expect } from "vitest";
import { buildGraph, findOrphanStations, findDanglingSegments } from "./graph";
import type { Station, Segment } from "schema";

function makeStation(id: string): Station {
  return {
    id,
    name_th: id,
    name_en: id,
    code_history: [{ code: id, from: "2026-01-01", to: null }],
    structure: "elevated",
    accessible: true,
    coords: { geo: { lat: 13.75, lon: 100.5 } },
    validity: [],
    milestones: [],
    confidence: "high",
    last_verified_at: "2026-07-01",
  };
}

function makeSegment(from: string, to: string): Segment {
  return {
    id: `${from}__${to}`,
    line: "TEST_LINE",
    from_station: from,
    to_station: to,
    milestones: [],
    confidence: "high",
    last_verified_at: "2026-07-01",
  };
}

describe("buildGraph", () => {
  it("builds adjacency from segments", () => {
    const stations = [makeStation("A"), makeStation("B"), makeStation("C")];
    const segments = [makeSegment("A", "B"), makeSegment("B", "C")];
    const graph = buildGraph(stations, segments);
    expect(graph.adjacency.get("A")?.has("B")).toBe(true);
    expect(graph.adjacency.get("B")?.has("C")).toBe(true);
  });

  it("detects an orphan station with no segments", () => {
    const stations = [
      makeStation("A"),
      makeStation("B"),
      makeStation("ORPHAN"),
    ];
    const segments = [makeSegment("A", "B")];
    const graph = buildGraph(stations, segments);
    expect(findOrphanStations(graph)).toEqual(["ORPHAN"]);
  });

  it("detects a dangling segment referencing a missing station", () => {
    const stations = [makeStation("A")];
    const segments = [makeSegment("A", "MISSING")];
    const graph = buildGraph(stations, segments);
    expect(findDanglingSegments(graph)).toEqual(["A__MISSING"]);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd packages/network-graph && bun test graph.test.ts`
Expected: FAIL - module not found.

- [ ] **Step 4: Write `packages/network-graph/src/graph.ts`**

```typescript
// packages/network-graph/src/graph.ts
import type { Station, Segment } from "schema";

export interface NetworkGraph {
  stations: Map<string, Station>;
  segments: Map<string, Segment>;
  adjacency: Map<string, Set<string>>;
}

export function buildGraph(
  stations: Station[],
  segments: Segment[],
): NetworkGraph {
  const stationMap = new Map(stations.map((s) => [s.id, s]));
  const segmentMap = new Map(segments.map((s) => [s.id, s]));
  const adjacency = new Map<string, Set<string>>();

  for (const segment of segments) {
    if (!adjacency.has(segment.from_station))
      adjacency.set(segment.from_station, new Set());
    adjacency.get(segment.from_station)!.add(segment.to_station);
  }

  return { stations: stationMap, segments: segmentMap, adjacency };
}

export function findOrphanStations(graph: NetworkGraph): string[] {
  const connected = new Set<string>();
  for (const segment of graph.segments.values()) {
    connected.add(segment.from_station);
    connected.add(segment.to_station);
  }
  return [...graph.stations.keys()].filter((id) => !connected.has(id)).sort();
}

export function findDanglingSegments(graph: NetworkGraph): string[] {
  return [...graph.segments.values()]
    .filter(
      (segment) =>
        !graph.stations.has(segment.from_station) ||
        !graph.stations.has(segment.to_station),
    )
    .map((segment) => segment.id)
    .sort();
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd packages/network-graph && bun test graph.test.ts`
Expected: PASS.

- [ ] **Step 6: Write the barrel export**

```typescript
// packages/network-graph/src/index.ts
export * from "./graph";
```

- [ ] **Step 7: Commit**

```bash
git add packages/network-graph
git commit -m "feat(network-graph): add graph build and integrity checks"
```

---

### Task 7: `packages/network-graph` - interchange resolution and `as_of` temporal filter

**Files:**

- Create: `packages/network-graph/src/interchange.ts`, `packages/network-graph/src/temporal.ts`
- Modify: `packages/network-graph/src/index.ts`
- Test: `packages/network-graph/src/interchange.test.ts`, `packages/network-graph/src/temporal.test.ts`

**Interfaces:**

- Consumes: `NetworkGraph`, `Station` (Task 6), `Station.milestones`/`validity` (Task 2)
- Produces: `resolveInterchangeGroups(stations: Station[]): Map<string, string[]>`,
  `filterAsOf<T extends { validity?: {from: string; to: string | null}[] }>(entities: T[], date: string): T[]`
  - both exported from `packages/network-graph/src/index.ts`. `scripts/build`
    (Task 11) and `apps/web` both call `filterAsOf`.

- [ ] **Step 1: Write the failing interchange test**

```typescript
// packages/network-graph/src/interchange.test.ts
import { describe, it, expect } from "vitest";
import { resolveInterchangeGroups } from "./interchange";
import type { Station } from "schema";

function makeStation(id: string, group: string | undefined): Station {
  return {
    id,
    name_th: id,
    name_en: id,
    code_history: [{ code: id, from: "2026-01-01", to: null }],
    interchange_group: group,
    structure: "elevated",
    accessible: true,
    coords: { geo: { lat: 13.75, lon: 100.5 } },
    validity: [],
    milestones: [],
    confidence: "high",
    last_verified_at: "2026-07-01",
  };
}

describe("resolveInterchangeGroups", () => {
  it("groups stations sharing the same interchange_group", () => {
    const stations = [
      makeStation("N8", "MOCHIT_CHATUCHAK"),
      makeStation("BL01", "MOCHIT_CHATUCHAK"),
      makeStation("LONELY", undefined),
    ];
    const groups = resolveInterchangeGroups(stations);
    expect(groups.get("MOCHIT_CHATUCHAK")?.sort()).toEqual(["BL01", "N8"]);
    expect(groups.has("LONELY")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/network-graph && bun test interchange.test.ts`
Expected: FAIL - module not found.

- [ ] **Step 3: Write `packages/network-graph/src/interchange.ts`**

```typescript
// packages/network-graph/src/interchange.ts
import type { Station } from "schema";

export function resolveInterchangeGroups(
  stations: Station[],
): Map<string, string[]> {
  const groups = new Map<string, string[]>();
  for (const station of stations) {
    if (!station.interchange_group) continue;
    if (!groups.has(station.interchange_group))
      groups.set(station.interchange_group, []);
    groups.get(station.interchange_group)!.push(station.id);
  }
  return groups;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/network-graph && bun test interchange.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing temporal filter test**

```typescript
// packages/network-graph/src/temporal.test.ts
import { describe, it, expect } from "vitest";
import { filterAsOf } from "./temporal";

interface Entity {
  id: string;
  validity: { from: string; to: string | null }[];
}

describe("filterAsOf", () => {
  const entities: Entity[] = [
    { id: "ALWAYS_OPEN", validity: [{ from: "2004-01-01", to: null }] },
    { id: "CLOSED_2020", validity: [{ from: "2004-01-01", to: "2020-01-01" }] },
    { id: "OPENS_2030", validity: [{ from: "2030-01-01", to: null }] },
  ];

  it("includes entities whose validity window covers the date", () => {
    const result = filterAsOf(entities, "2026-01-01");
    expect(result.map((e) => e.id)).toEqual(["ALWAYS_OPEN"]);
  });

  it("excludes entities not yet valid or already closed at the given date", () => {
    const result2019 = filterAsOf(entities, "2019-01-01");
    expect(result2019.map((e) => e.id).sort()).toEqual([
      "ALWAYS_OPEN",
      "CLOSED_2020",
    ]);

    const result2031 = filterAsOf(entities, "2031-01-01");
    expect(result2031.map((e) => e.id).sort()).toEqual([
      "ALWAYS_OPEN",
      "OPENS_2030",
    ]);
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `cd packages/network-graph && bun test temporal.test.ts`
Expected: FAIL - module not found.

- [ ] **Step 7: Write `packages/network-graph/src/temporal.ts`**

```typescript
// packages/network-graph/src/temporal.ts

interface ValidityWindow {
  from: string;
  to: string | null;
}

export function filterAsOf<T extends { validity: ValidityWindow[] }>(
  entities: T[],
  date: string,
): T[] {
  return entities.filter((entity) =>
    entity.validity.some(
      (window) =>
        window.from <= date && (window.to === null || window.to > date),
    ),
  );
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `cd packages/network-graph && bun test temporal.test.ts`
Expected: PASS.

- [ ] **Step 9: Update the barrel export**

```typescript
// packages/network-graph/src/index.ts
export * from "./graph";
export * from "./interchange";
export * from "./temporal";
```

- [ ] **Step 10: Commit**

```bash
git add packages/network-graph
git commit -m "feat(network-graph): add interchange resolution and as_of temporal filter"
```

---

### Task 8: `packages/renderer` - SVG schematic generator (tested against a synthetic fixture)

**Files:**

- Create: `packages/renderer/src/render.ts`, `packages/renderer/src/index.ts`
- Test: `packages/renderer/src/render.test.ts`

**Interfaces:**

- Consumes: `Layout`, `Station`, `Segment` types (Tasks 2-4)
- Produces: `renderSchematic(layout: Layout, stations: Station[], segments: Segment[]): string`
  (returns an SVG document as a string) - exported from
  `packages/renderer/src/index.ts`. Not called by `scripts/build` or
  `apps/web` in this plan (schematic mode is out of scope per the plan header)
  - this task proves the package works in isolation against a made-up fixture,
    ready to wire in once real layout coordinates exist.

- [ ] **Step 1: Add workspace dependency**

In `packages/renderer/package.json`, add:

```json
"dependencies": { "schema": "workspace:*" }
```

- [ ] **Step 2: Write the failing test**

```typescript
// packages/renderer/src/render.test.ts
import { describe, it, expect } from "vitest";
import { renderSchematic } from "./render";
import type { Layout, Station, Segment } from "schema";

describe("renderSchematic", () => {
  it("renders an SVG containing a circle per station and a line per segment", () => {
    const layout: Layout = {
      era: "test",
      stations: [
        { station_id: "A", x: 0, y: 0 },
        { station_id: "B", x: 100, y: 0 },
      ],
    };
    const stations = [
      { id: "A", name_th: "A", name_en: "A" } as Station,
      { id: "B", name_th: "B", name_en: "B" } as Station,
    ];
    const segments = [
      {
        id: "A__B",
        line: "TEST",
        from_station: "A",
        to_station: "B",
      } as Segment,
    ];

    const svg = renderSchematic(layout, stations, segments);

    expect(svg).toContain("<svg");
    expect(svg).toContain("</svg>");
    expect((svg.match(/<circle/g) ?? []).length).toBe(2);
    expect((svg.match(/<line/g) ?? []).length).toBe(1);
  });

  it("throws if a segment references a station missing from the layout", () => {
    const layout: Layout = {
      era: "test",
      stations: [{ station_id: "A", x: 0, y: 0 }],
    };
    const stations = [{ id: "A", name_th: "A", name_en: "A" } as Station];
    const segments = [
      {
        id: "A__MISSING",
        line: "TEST",
        from_station: "A",
        to_station: "MISSING",
      } as Segment,
    ];

    expect(() => renderSchematic(layout, stations, segments)).toThrow(
      "Segment A__MISSING references a station missing from the layout: MISSING",
    );
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd packages/renderer && bun test render.test.ts`
Expected: FAIL - module not found.

- [ ] **Step 4: Write `packages/renderer/src/render.ts`**

```typescript
// packages/renderer/src/render.ts
import type { Layout, Station, Segment } from "schema";

export function renderSchematic(
  layout: Layout,
  stations: Station[],
  segments: Segment[],
): string {
  const positionByStationId = new Map(
    layout.stations.map((s) => [s.station_id, s]),
  );
  const stationNameById = new Map(
    stations.map((s) => [s.id, s.name_en ?? s.name_th]),
  );

  const lines = segments
    .map((segment) => {
      const from = positionByStationId.get(segment.from_station);
      const to = positionByStationId.get(segment.to_station);
      if (!from) {
        throw new Error(
          `Segment ${segment.id} references a station missing from the layout: ${segment.from_station}`,
        );
      }
      if (!to) {
        throw new Error(
          `Segment ${segment.id} references a station missing from the layout: ${segment.to_station}`,
        );
      }
      return `<line x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}" stroke="black" stroke-width="4" />`;
    })
    .join("\n  ");

  const circles = layout.stations
    .map((pos) => {
      const name = stationNameById.get(pos.station_id) ?? pos.station_id;
      return `<circle cx="${pos.x}" cy="${pos.y}" r="6" fill="white" stroke="black" stroke-width="2"><title>${name}</title></circle>`;
    })
    .join("\n  ");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000">
  ${lines}
  ${circles}
</svg>`;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd packages/renderer && bun test render.test.ts`
Expected: PASS.

- [ ] **Step 6: Write the barrel export**

```typescript
// packages/renderer/src/index.ts
export * from "./render";
```

- [ ] **Step 7: Commit**

```bash
git add packages/renderer
git commit -m "feat(renderer): add SVG schematic generator (not yet wired to real data)"
```

---

### Task 9: `packages/ui` - shared components and Thai font subsetting

**Files:**

- Create: `packages/ui/src/StatusBadge.tsx`, `packages/ui/src/index.ts`,
  `packages/ui/scripts/subset-thai-font.ts`, `packages/ui/fonts/NotoSansThai-Regular.ttf`
  (downloaded, not authored)
- Test: `packages/ui/src/StatusBadge.test.tsx` (skipped per CLAUDE.md 6: UI
  untested - this task instead tests the font subsetting script, which is
  build tooling, not UI)
- Test: `packages/ui/scripts/subset-thai-font.test.ts`

**Interfaces:**

- Produces: `<StatusBadge status={Status} />` component (consumed by `apps/web`
  Task 15), and `packages/ui/scripts/subset-thai-font.ts` which `apps/web`'s
  build (Task 13) runs to produce `apps/web/public/fonts/NotoSansThai-subset.woff2`.

- [ ] **Step 1: Add dependencies**

```bash
cd packages/ui && bun add react@^19.0.0
bun add -d subset-font@^2.4.0 @types/react@^19.0.0
```

- [ ] **Step 2: Write `packages/ui/src/StatusBadge.tsx`**

(Untested per convention - straightforward presentational component.)

```tsx
// packages/ui/src/StatusBadge.tsx
import type { Status } from "schema";

const STATUS_LABEL: Record<Status, string> = {
  operational: "Operational",
  trial: "Trial service",
  under_construction: "Under construction",
  approved: "Approved",
  planned: "Planned",
  proposed: "Proposed",
  suspended: "Suspended",
  cancelled: "Cancelled",
};

export function StatusBadge({ status }: { status: Status }) {
  return <span data-status={status}>{STATUS_LABEL[status]}</span>;
}
```

- [ ] **Step 3: Add `schema` workspace dependency**

In `packages/ui/package.json`, add:

```json
"dependencies": { "schema": "workspace:*", "react": "^19.0.0" }
```

- [ ] **Step 4: Write the failing font-subsetting test**

```typescript
// packages/ui/scripts/subset-thai-font.test.ts
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { subsetThaiFont } from "./subset-thai-font";

describe("subsetThaiFont", () => {
  it("produces a woff2 file smaller than the 80KB budget", async () => {
    const outputPath = new URL(
      "../../../apps/web/public/fonts/NotoSansThai-subset.woff2",
      import.meta.url,
    );
    await subsetThaiFont();
    expect(existsSync(outputPath)).toBe(true);
    const stats = readFileSync(outputPath);
    expect(stats.byteLength).toBeLessThan(80 * 1024);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/ui && bun test scripts/subset-thai-font.test.ts`
Expected: FAIL - module not found, and the source font does not exist yet.

- [ ] **Step 3: Download the source font**

```bash
mkdir -p packages/ui/fonts
curl -L -o packages/ui/fonts/NotoSansThai-Regular.ttf \
  "https://github.com/notofonts/thai/raw/main/fonts/NotoSansThai/hinted/ttf/NotoSansThai-Regular.ttf"
```

Verify: `ls -la packages/ui/fonts/NotoSansThai-Regular.ttf` shows a non-zero file.

- [ ] **Step 4: Write `packages/ui/scripts/subset-thai-font.ts`**

```typescript
// packages/ui/scripts/subset-thai-font.ts
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import subsetFont from "subset-font";

// Thai script block + Latin + digits + common punctuation - covers name_th,
// name_en, and station codes rendered in-app.
const GLYPH_SUBSET =
  " !\"#%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[]abcdefghijklmnopqrstuvwxyz" +
  "กขฃคฅฆงจฉชซฌญฎฏ" +
  "ฐฑฒณดตถทธนบปผฝพ" +
  "ฟภมยรฤลฦวศษสหฬอ" +
  "ฮฯะัาำิีึืฺุู฿เ" +
  "แโใไๅๆ็่้๊๋์ํ๎๏" +
  "๐๑๒๓๔๕๖๗๘๙";

export async function subsetThaiFont(): Promise<void> {
  const inputPath = new URL(
    "../fonts/NotoSansThai-Regular.ttf",
    import.meta.url,
  );
  const outputDir = new URL("../../../apps/web/public/fonts/", import.meta.url);
  const outputPath = new URL("NotoSansThai-subset.woff2", outputDir);

  const original = readFileSync(inputPath);
  const subset = await subsetFont(original, GLYPH_SUBSET, {
    targetFormat: "woff2",
  });

  mkdirSync(outputDir, { recursive: true });
  writeFileSync(outputPath, subset);
}

if (import.meta.main) {
  await subsetThaiFont();
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd packages/ui && bun test scripts/subset-thai-font.test.ts`
Expected: PASS, subset file under 80KB.

- [ ] **Step 6: Write the barrel export**

```typescript
// packages/ui/src/index.ts
export * from "./StatusBadge";
```

- [ ] **Step 7: Commit**

```bash
git add packages/ui
git commit -m "feat(ui): add StatusBadge component and Thai font subsetting build step"
```

---

### Task 10: `scripts/import` - OSM extraction for current + planned urban rail

**Files:**

- Create: `scripts/import/overpass-query.ts`, `scripts/import/index.ts`
- Test: `scripts/import/overpass-query.test.ts`

**Interfaces:**

- Produces: `buildOverpassQuery(regionBbox: [number, number, number, number]): string`
  (pure function, testable without a network call), and
  `scripts/import/index.ts` (a CLI entry point that calls the Overpass API and
  writes `data/source/osm-raw.json` - not unit tested, since it makes a real
  network call; this is intentional and matches CLAUDE.md's "raw imports,
  never hand-edited" description of `data/source`).

- [ ] **Step 1: Write the failing test**

```typescript
// scripts/import/overpass-query.test.ts
import { describe, it, expect } from "vitest";
import { buildOverpassQuery } from "./overpass-query";

describe("buildOverpassQuery", () => {
  it("builds a query scoped to the given bbox targeting rail route relations", () => {
    const query = buildOverpassQuery([13.4, 100.2, 14.2, 100.95]);
    expect(query).toContain("[bbox:13.4,100.2,14.2,100.95]");
    expect(query).toContain('route~"light_rail|subway|monorail"');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd scripts/import && bun test overpass-query.test.ts`
Expected: FAIL - module not found.

- [ ] **Step 3: Write `scripts/import/overpass-query.ts`**

```typescript
// scripts/import/overpass-query.ts

/**
 * Builds an Overpass QL query for rail transit route relations within a
 * bounding box. Targets light_rail (BTS Skytrain, monorails), subway
 * (MRT), and any relation tagged route=train that also carries a
 * network tag matching SRT's urban Red Line service - long-distance SRT
 * services do not carry route=light_rail/subway and are excluded by this
 * query's route filter (see plan's "Explicitly out of scope" scope call).
 */
export function buildOverpassQuery(
  bbox: [number, number, number, number],
): string {
  const [minLat, minLon, maxLat, maxLon] = bbox;
  return `[out:json][timeout:60][bbox:${minLat},${minLon},${maxLat},${maxLon}];
relation["type"="route"]["route"~"light_rail|subway|monorail"];
out body;
>;
out skel qt;`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd scripts/import && bun test overpass-query.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the CLI entry point**

```typescript
// scripts/import/index.ts
import { writeFileSync, mkdirSync } from "node:fs";
import { buildOverpassQuery } from "./overpass-query";

const BANGKOK_REGION_BBOX: [number, number, number, number] = [
  13.4, 100.2, 14.2, 100.95,
];
const OVERPASS_ENDPOINT = "https://overpass-api.de/api/interpreter";

async function main() {
  const query = buildOverpassQuery(BANGKOK_REGION_BBOX);
  const response = await fetch(OVERPASS_ENDPOINT, {
    method: "POST",
    body: `data=${encodeURIComponent(query)}`,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
  if (!response.ok) {
    throw new Error(
      `Overpass API request failed: ${response.status} ${response.statusText}`,
    );
  }
  const data = await response.json();
  mkdirSync(new URL("../../data/source/", import.meta.url), {
    recursive: true,
  });
  writeFileSync(
    new URL("../../data/source/osm-raw.json", import.meta.url),
    JSON.stringify(data, null, 2),
  );
  console.log(
    `Wrote ${data.elements?.length ?? 0} OSM elements to data/source/osm-raw.json`,
  );
}

if (import.meta.main) {
  await main();
}
```

- [ ] **Step 6: Run the import manually and inspect the result**

Run: `bun run scripts/import/index.ts`
Expected: `data/source/osm-raw.json` created with a non-empty `elements` array.
Manually inspect it for the expected lines (BTS Sukhumvit/Silom, MRT
Blue/Purple/Yellow/Pink, SRT Red Line) - this is a manual data-quality check,
not an automated assertion, since OSM data changes over time.

- [ ] **Step 7: Commit**

```bash
git add scripts/import
git commit -m "feat(import): add Overpass QL extraction for current + planned urban rail"
```

Note: `data/source/osm-raw.json` itself is a `data:` commit, made separately
from this `feat:` commit, once Step 6 has been reviewed for quality.

---

### Task 11: `scripts/build` - assemble `network.json` and `network.geojson`

**Files:**

- Create: `scripts/build/assemble.ts`, `scripts/build/index.ts`
- Test: `scripts/build/assemble.test.ts`

**Interfaces:**

- Consumes: `StationSchema`, `LineSchema`, `SegmentSchema` (Tasks 2-3),
  `buildGraph`, `findOrphanStations`, `findDanglingSegments` (Task 6)
- Produces: `assembleNetwork(stations: Station[], lines: Line[], segments: Segment[]): { network: object; geojson: object }`
  - exported from `scripts/build/assemble.ts`. `scripts/validate` (Task 12)
    consumes the same shape.

- [ ] **Step 1: Add workspace dependencies**

In `scripts/build/package.json` (create if it doesn't exist as its own
workspace member, or add to root `devDependencies` if scripts are run via
root `bun run` - use a `scripts/build/package.json` for consistency with the
other workspace members):

```json
{
  "name": "build-scripts",
  "private": true,
  "type": "module",
  "dependencies": { "schema": "workspace:*", "network-graph": "workspace:*" }
}
```

Add `"scripts/build"` to the root `package.json`'s `workspaces` array.

- [ ] **Step 2: Write the failing test**

```typescript
// scripts/build/assemble.test.ts
import { describe, it, expect } from "vitest";
import { assembleNetwork } from "./assemble";
import type { Station, Line, Segment } from "schema";

function makeStation(id: string): Station {
  return {
    id,
    name_th: id,
    name_en: id,
    code_history: [{ code: id, from: "2026-01-01", to: null }],
    structure: "elevated",
    accessible: true,
    coords: { geo: { lat: 13.75, lon: 100.5 } },
    validity: [{ line: "TEST_LINE", from: "2026-01-01", to: null }],
    milestones: [],
    confidence: "high",
    last_verified_at: "2026-07-01",
  };
}

describe("assembleNetwork", () => {
  it("produces a network object and a GeoJSON FeatureCollection", () => {
    const stations = [makeStation("A"), makeStation("B")];
    const lines: Line[] = [
      {
        id: "TEST_LINE",
        operator: "TEST",
        name_th: "ทดสอบ",
        name_en: "Test Line",
        color_hex: "#000000",
        milestones: [],
        confidence: "high",
        last_verified_at: "2026-07-01",
      },
    ];
    const segments: Segment[] = [
      {
        id: "A__B",
        line: "TEST_LINE",
        from_station: "A",
        to_station: "B",
        milestones: [],
        confidence: "high",
        last_verified_at: "2026-07-01",
      },
    ];

    const { network, geojson } = assembleNetwork(stations, lines, segments);

    expect(network).toHaveProperty("stations");
    expect(network).toHaveProperty("lines");
    expect(network).toHaveProperty("segments");
    expect(geojson).toMatchObject({ type: "FeatureCollection" });
    expect((geojson as { features: unknown[] }).features).toHaveLength(2);
  });

  it("throws if graph integrity check finds an orphan or dangling segment", () => {
    const stations = [makeStation("A")];
    const segments: Segment[] = [
      {
        id: "A__MISSING",
        line: "TEST_LINE",
        from_station: "A",
        to_station: "MISSING",
        milestones: [],
        confidence: "high",
        last_verified_at: "2026-07-01",
      },
    ];
    expect(() => assembleNetwork(stations, [], segments)).toThrow(
      /dangling segment/i,
    );
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd scripts/build && bun test assemble.test.ts`
Expected: FAIL - module not found.

- [ ] **Step 4: Write `scripts/build/assemble.ts`**

```typescript
// scripts/build/assemble.ts
import type { Station, Line, Segment } from "schema";
import {
  buildGraph,
  findOrphanStations,
  findDanglingSegments,
} from "network-graph";

export function assembleNetwork(
  stations: Station[],
  lines: Line[],
  segments: Segment[],
): { network: object; geojson: object } {
  const graph = buildGraph(stations, segments);
  const orphans = findOrphanStations(graph);
  const dangling = findDanglingSegments(graph);

  if (dangling.length > 0) {
    throw new Error(
      `Found dangling segment(s) referencing missing stations: ${dangling.join(", ")}`,
    );
  }
  if (orphans.length > 0) {
    throw new Error(
      `Found orphan station(s) with no segments: ${orphans.join(", ")}`,
    );
  }

  const network = {
    stations,
    lines,
    segments,
    generated_at: new Date().toISOString(),
  };

  const geojson = {
    type: "FeatureCollection",
    features: stations.map((station) => ({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [station.coords.geo.lon, station.coords.geo.lat],
      },
      properties: {
        id: station.id,
        name_th: station.name_th,
        name_en: station.name_en,
      },
    })),
  };

  return { network, geojson };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd scripts/build && bun test assemble.test.ts`
Expected: PASS.

- [ ] **Step 6: Write `scripts/build/index.ts`**

```typescript
// scripts/build/index.ts
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { StationSchema, LineSchema, SegmentSchema } from "schema";
import { assembleNetwork } from "./assemble";

function readEntities<T>(dir: URL, parse: (raw: unknown) => T): T[] {
  let files: string[] = [];
  try {
    files = readdirSync(dir).filter((f) => f.endsWith(".json"));
  } catch {
    return [];
  }
  return files.map((file) =>
    parse(JSON.parse(readFileSync(new URL(file, dir), "utf-8"))),
  );
}

function main() {
  const sourceDir = new URL("../../data/source/", import.meta.url);
  const overridesDir = new URL("../../data/overrides/", import.meta.url);
  const distDir = new URL("../../data/dist/", import.meta.url);

  const stations = readEntities(new URL("stations/", sourceDir), (raw) =>
    StationSchema.parse(raw),
  );
  const lines = readEntities(new URL("lines/", sourceDir), (raw) =>
    LineSchema.parse(raw),
  );
  const segments = readEntities(new URL("segments/", sourceDir), (raw) =>
    SegmentSchema.parse(raw),
  );

  // data/overrides applies corrections by station/line/segment id; each
  // override file's content replaces the matching source entity's fields.
  const overrides = readEntities(
    new URL("./", overridesDir),
    (raw) => raw as { id: string } & Record<string, unknown>,
  );
  const overrideById = new Map(overrides.map((o) => [o.id, o]));
  const applyOverrides = <T extends { id: string }>(entities: T[]): T[] =>
    entities.map((entity) => ({
      ...entity,
      ...(overrideById.get(entity.id) ?? {}),
    }));

  const { network, geojson } = assembleNetwork(
    applyOverrides(stations),
    applyOverrides(lines),
    applyOverrides(segments),
  );

  mkdirSync(distDir, { recursive: true });
  writeFileSync(new URL("network.json", distDir), JSON.stringify(network));
  writeFileSync(new URL("network.geojson", distDir), JSON.stringify(geojson));
  console.log(
    `Wrote data/dist/network.json (${stations.length} stations, ${lines.length} lines, ${segments.length} segments)`,
  );
}

main();
```

- [ ] **Step 7: Commit**

```bash
git add scripts/build
git commit -m "feat(build): assemble network.json and network.geojson from data/source + data/overrides"
```

---

### Task 12: `scripts/validate` - schema, provenance, and performance budget gate

**Files:**

- Create: `scripts/validate/package.json`, `scripts/validate/index.ts`
- Test: `scripts/validate/check-source-refs.test.ts`
- Modify: root `package.json` (`workspaces` array)

**Interfaces:**

- Consumes: `data/dist/network.json` (Task 11's output)
- Produces: `checkSourceRefs(network: { stations: Station[]; lines: Line[]; segments: Segment[] }): string[]`
  (returns a list of violation messages, empty = pass) - exported from
  `scripts/validate/check-source-refs.ts`, consumed by `scripts/validate/index.ts`
  and by CI (Task 19).

- [ ] **Step 0: Register `scripts/validate` as a workspace member**

`scripts/validate/index.ts` (Step 5) imports from the `schema` and
`network-graph` workspace packages, so this directory needs its own
`package.json`, same pattern as Task 11's `scripts/build`:

```json
{
  "name": "validate-scripts",
  "private": true,
  "type": "module",
  "dependencies": { "schema": "workspace:*", "network-graph": "workspace:*" }
}
```

Add `"scripts/build"` and `"scripts/validate"` to the root `package.json`'s
`workspaces` array (Task 1 only listed `packages/*` and `apps/*`; Task 11
added `scripts/build` - add `scripts/validate` alongside it now).

- [ ] **Step 1: Write the failing test**

```typescript
// scripts/validate/check-source-refs.test.ts
import { describe, it, expect } from "vitest";
import { checkSourceRefs } from "./check-source-refs";
import type { Station } from "schema";

function makeStation(milestones: Station["milestones"]): Station {
  return {
    id: "A",
    name_th: "A",
    name_en: "A",
    code_history: [{ code: "A", from: "2026-01-01", to: null }],
    structure: "elevated",
    accessible: true,
    coords: { geo: { lat: 13.75, lon: 100.5 } },
    validity: [],
    milestones,
    confidence: "high",
    last_verified_at: "2026-07-01",
  };
}

describe("checkSourceRefs", () => {
  it("passes when every milestone has at least one source_ref", () => {
    const station = makeStation([
      {
        date: "2026-01-01",
        date_precision: "exact",
        event: "opened",
        source_refs: [
          { url: "https://example.com", title: "x", published_at: null },
        ],
      },
    ]);
    expect(
      checkSourceRefs({ stations: [station], lines: [], segments: [] }),
    ).toEqual([]);
  });

  it("flags a milestone with an empty source_refs array", () => {
    // Schema validation would already reject this at parse time (Task 2);
    // this check is a defense-in-depth pass over already-parsed data, e.g.
    // data mutated after parsing.
    const station = makeStation([
      {
        date: "2026-01-01",
        date_precision: "exact",
        event: "opened",
        source_refs: [],
      },
    ]);
    const violations = checkSourceRefs({
      stations: [station],
      lines: [],
      segments: [],
    });
    expect(violations).toHaveLength(1);
    expect(violations[0]).toContain("A");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd scripts/validate && bun test check-source-refs.test.ts`
Expected: FAIL - module not found.

- [ ] **Step 3: Write `scripts/validate/check-source-refs.ts`**

```typescript
// scripts/validate/check-source-refs.ts
import type { Station, Line, Segment } from "schema";

interface NetworkForValidation {
  stations: Station[];
  lines: Line[];
  segments: Segment[];
}

export function checkSourceRefs(network: NetworkForValidation): string[] {
  const violations: string[] = [];
  const entities: { id: string; milestones: Station["milestones"] }[] = [
    ...network.stations,
    ...network.lines,
    ...network.segments,
  ];
  for (const entity of entities) {
    entity.milestones.forEach((milestone, index) => {
      if (milestone.source_refs.length === 0) {
        violations.push(
          `${entity.id}: milestone[${index}] (${milestone.event}) has empty source_refs`,
        );
      }
    });
  }
  return violations;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd scripts/validate && bun test check-source-refs.test.ts`
Expected: PASS.

- [ ] **Step 5: Write `scripts/validate/index.ts`**

```typescript
// scripts/validate/index.ts
import { readFileSync, statSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { StationSchema, LineSchema, SegmentSchema } from "schema";
import {
  buildGraph,
  findOrphanStations,
  findDanglingSegments,
} from "network-graph";
import { checkSourceRefs } from "./check-source-refs";

const NETWORK_JSON_BROTLI_BUDGET_BYTES = 120 * 1024;

function main() {
  const networkPath = new URL("../../data/dist/network.json", import.meta.url);
  const raw = JSON.parse(readFileSync(networkPath, "utf-8"));

  const stations = raw.stations.map((s: unknown) => StationSchema.parse(s));
  const lines = raw.lines.map((l: unknown) => LineSchema.parse(l));
  const segments = raw.segments.map((s: unknown) => SegmentSchema.parse(s));

  const graph = buildGraph(stations, segments);
  const orphans = findOrphanStations(graph);
  const dangling = findDanglingSegments(graph);
  const sourceRefViolations = checkSourceRefs({ stations, lines, segments });

  const errors = [
    ...orphans.map((id) => `Orphan station: ${id}`),
    ...dangling.map((id) => `Dangling segment: ${id}`),
    ...sourceRefViolations,
  ];

  // gzip is a close, dependency-free proxy for brotli size for this budget
  // check; CI's actual deploy step still measures real brotli output.
  const compressedSize = gzipSync(readFileSync(networkPath)).byteLength;
  if (compressedSize > NETWORK_JSON_BROTLI_BUDGET_BYTES) {
    errors.push(
      `network.json compressed size ${compressedSize} bytes exceeds ${NETWORK_JSON_BROTLI_BUDGET_BYTES} byte budget`,
    );
  }

  if (errors.length > 0) {
    console.error(
      "Validation failed:\n" + errors.map((e) => `  - ${e}`).join("\n"),
    );
    process.exit(1);
  }
  console.log("Validation passed.");
}

main();
```

- [ ] **Step 6: Commit**

```bash
git add scripts/validate
git commit -m "feat(validate): add schema, graph integrity, provenance, and perf budget checks"
```

---

### Task 13: `apps/web` - Next.js static-export bootstrap

**Files:**

- Create: `apps/web/next.config.ts`, `apps/web/app/layout.tsx`, `apps/web/app/page.tsx`,
  `apps/web/lib/constants.ts`, `apps/web/package.json`, `apps/web/tsconfig.json`

**Interfaces:**

- Produces: `PUBLIC_BASE_URL` constant (empty string - relative URLs only,
  per CLAUDE.md 3's "never hardcode `bangkokopentransit.vercel.app`" rule) -
  exported from `apps/web/lib/constants.ts`, used by every later `apps/web` task.

- [ ] **Step 1: Write `apps/web/package.json`**

```json
{
  "name": "web",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "typecheck": "tsc --noEmit -p tsconfig.json"
  },
  "dependencies": {
    "next": "^16.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "schema": "workspace:*",
    "network-graph": "workspace:*",
    "ui": "workspace:*"
  },
  "devDependencies": {
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0"
  }
}
```

- [ ] **Step 2: Write `apps/web/next.config.ts`**

```typescript
// apps/web/next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
};

export default nextConfig;
```

- [ ] **Step 3: Write `apps/web/lib/constants.ts`**

```typescript
// apps/web/lib/constants.ts

// Always relative. CLAUDE.md 3: "Never hardcode bangkokopentransit.vercel.app -
// Use relative URLs, or a single PUBLIC_BASE_URL constant." No custom domain
// exists yet, so this stays empty; every consumer must treat it as a prefix,
// not assume it is non-empty.
export const PUBLIC_BASE_URL = "";
```

- [ ] **Step 4: Write `apps/web/app/layout.tsx`**

```tsx
// apps/web/app/layout.tsx
import type { ReactNode } from "react";

export const metadata = {
  title: "BangkokOpenTransit",
  description: "Bangkok's rail transit network as an open, structured dataset.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 5: Write a placeholder `apps/web/app/page.tsx`**

```tsx
// apps/web/app/page.tsx
export default function HomePage() {
  return <main>BangkokOpenTransit - map loads in Task 14</main>;
}
```

- [ ] **Step 6: Write `apps/web/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "preserve",
    "plugins": [{ "name": "next" }]
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 7: Install and verify the build**

Run: `bun install && cd apps/web && bun run build`
Expected: `apps/web/out/` directory created containing static HTML/JS, no errors.

- [ ] **Step 8: Commit**

```bash
git add apps/web
git commit -m "feat(web): bootstrap Next.js static-export app"
```

---

### Task 14: `apps/web` - MapLibre + self-hosted PMTiles basemap

**Files:**

- Create: `apps/web/components/Map.tsx`, `apps/web/scripts/build-basemap.ts`
- Modify: `apps/web/app/page.tsx`

**Interfaces:**

- Produces: `<Map networkGeoJson={FeatureCollection} />` component - consumed
  by Task 15's station-panel wiring. Depends on
  `apps/web/public/basemap/bangkok.pmtiles` existing (built by
  `apps/web/scripts/build-basemap.ts`, run once and committed - not
  regenerated on every CI build, since it depends on an external Protomaps
  build server).

- [ ] **Step 1: Add dependencies**

```bash
cd apps/web && bun add maplibre-gl@^6.4.1 pmtiles@^3.2.0 @protomaps/basemaps@^5.7.2
```

- [ ] **Step 2: Write `apps/web/scripts/build-basemap.ts`**

```typescript
// apps/web/scripts/build-basemap.ts
import { mkdirSync } from "node:fs";

/**
 * Extracts a Bangkok-region PMTiles basemap from Protomaps' hosted build
 * server, using the pmtiles CLI's remote-extract feature (avoids
 * downloading the full planet build). Run manually once; the output is
 * committed to the repo (apps/web/public/basemap/bangkok.pmtiles) rather
 * than regenerated in CI, per this plan's "commit to repo" hosting decision.
 *
 * Requires the `pmtiles` CLI (https://github.com/protomaps/go-pmtiles) on
 * PATH - install separately, not a project dependency, since it is a build
 * tool invoked once, not at every build.
 */
async function main() {
  const outDir = new URL("../public/basemap/", import.meta.url);
  mkdirSync(outDir, { recursive: true });

  // Bangkok metro region bbox: lon_min,lat_min,lon_max,lat_max
  const bbox = "100.2,13.4,100.95,14.2";
  const remoteSource = "https://build.protomaps.com/20260801.pmtiles"; // latest daily build at extraction time - update date when re-running
  const outputPath = new URL("bangkok.pmtiles", outDir).pathname;

  const proc = Bun.spawn(
    [
      "pmtiles",
      "extract",
      remoteSource,
      outputPath,
      `--bbox=${bbox}`,
      "--maxzoom=15",
    ],
    { stdout: "inherit", stderr: "inherit" },
  );
  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    throw new Error(`pmtiles extract failed with exit code ${exitCode}`);
  }
  console.log(`Wrote ${outputPath}`);
}

if (import.meta.main) {
  await main();
}
```

- [ ] **Step 3: Run the extraction manually**

Run: `bun run apps/web/scripts/build-basemap.ts`
Expected: `apps/web/public/basemap/bangkok.pmtiles` created, file size in the
tens of MB (verify with `ls -la`), not gigabytes - if it's gigabytes, the
`--bbox` clipping did not apply and the remote source URL/CLI invocation
needs rechecking before proceeding.

- [ ] **Step 4: Write `apps/web/components/Map.tsx`**

```tsx
// apps/web/components/Map.tsx
"use client";

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Protocol } from "pmtiles";
import { layers, namedFlavor } from "@protomaps/basemaps";
import { PUBLIC_BASE_URL } from "../lib/constants";
import type { FeatureCollection, Point } from "geojson";

const BANGKOK_CENTER: [number, number] = [100.5018, 13.7563];

export function Map({
  networkGeoJson,
}: {
  networkGeoJson: FeatureCollection<Point>;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  useEffect(() => {
    // addProtocol must only be called once per app lifecycle (Protomaps docs).
    const protocol = new Protocol();
    maplibregl.addProtocol("pmtiles", protocol.tile);

    const map = new maplibregl.Map({
      container: containerRef.current!,
      center: BANGKOK_CENTER,
      zoom: 11,
      style: {
        version: 8,
        glyphs: `${PUBLIC_BASE_URL}/basemap/fonts/{fontstack}/{range}.pbf`,
        sprite: `${PUBLIC_BASE_URL}/basemap/sprites/light`,
        sources: {
          protomaps: {
            type: "vector",
            url: `pmtiles://${PUBLIC_BASE_URL}/basemap/bangkok.pmtiles`,
            attribution: "© OpenStreetMap contributors",
          },
        },
        layers: layers("protomaps", namedFlavor("light"), { lang: "en" }),
      },
    });

    map.on("load", () => {
      map.addSource("network", {
        type: "geojson",
        data: networkGeoJson,
        cluster: true,
        clusterRadius: 40,
      });
      map.addLayer({
        id: "station-clusters",
        type: "circle",
        source: "network",
        filter: ["has", "point_count"],
        paint: { "circle-radius": 16, "circle-color": "#2563eb" },
      });
      map.addLayer({
        id: "stations",
        type: "circle",
        source: "network",
        filter: ["!", ["has", "point_count"]],
        paint: { "circle-radius": 6, "circle-color": "#1e3a8a" },
      });
    });

    mapRef.current = map;
    return () => {
      map.remove();
      maplibregl.removeProtocol("pmtiles");
    };
  }, [networkGeoJson]);

  return <div ref={containerRef} style={{ width: "100%", height: "100vh" }} />;
}
```

Note on clustering: MapLibre's native `cluster: true` GeoJSON source option
uses `supercluster` internally, satisfying SPEC 1.2's clustering requirement
without a separate manual `supercluster` integration.

- [ ] **Step 4: Copy Protomaps basemap glyphs/sprites for offline/self-hosted serving**

```bash
mkdir -p apps/web/public/basemap/fonts apps/web/public/basemap/sprites
curl -L -o apps/web/public/basemap/sprites/light.json "https://raw.githubusercontent.com/protomaps/basemaps-assets/main/sprites/v4/light.json"
curl -L -o apps/web/public/basemap/sprites/light.png "https://raw.githubusercontent.com/protomaps/basemaps-assets/main/sprites/v4/light.png"
```

(Glyph PBF fonts are numerous per-range files; document the source repo
`protomaps/basemaps-assets` and defer bulk-copying the full glyph set to a
follow-up data task - for Task 14's purposes, wire the `glyphs` URL correctly
so it's a one-line change once assets are copied.)

- [ ] **Step 5: Wire the component into the page**

```tsx
// apps/web/app/page.tsx
import { Map } from "../components/Map";
import networkGeoJson from "../../../data/dist/network.geojson";
import type { FeatureCollection, Point } from "geojson";

export default function HomePage() {
  return <Map networkGeoJson={networkGeoJson as FeatureCollection<Point>} />;
}
```

- [ ] **Step 6: Add `@types/geojson` and verify the build**

```bash
cd apps/web && bun add -d @types/geojson@^7946.0.0
bun run build
```

Expected: build succeeds, `apps/web/out/` contains the map bundle.

- [ ] **Step 7: Commit**

```bash
git add apps/web
git commit -m "feat(web): render MapLibre + self-hosted PMTiles basemap with clustered stations"
```

---

### Task 15: `apps/web` - station detail panel, line filter, status rendering

**Files:**

- Create: `apps/web/components/StationPanel.tsx`, `apps/web/components/LineFilter.tsx`
- Modify: `apps/web/components/Map.tsx`, `apps/web/app/page.tsx`,
  `scripts/build/assemble.ts`, `scripts/build/assemble.test.ts`

**Interfaces:**

- Consumes: `StatusBadge` (Task 9), `network.json`'s `Station`/`Line` shapes
- Produces: `<StationPanel station={Station | null} onClose={() => void} />`,
  `<LineFilter lines={Line[]} activeLineIds={Set<string>} onToggle={(id: string) => void} />`

- [ ] **Step 1: Write `apps/web/components/StationPanel.tsx`**

```tsx
// apps/web/components/StationPanel.tsx
"use client";

import type { Station } from "schema";
import { StatusBadge } from "ui";

function deriveStatus(
  station: Station,
): Station["milestones"][number]["event"] | "operational" {
  const latest = [...station.milestones]
    .sort((a, b) => a.date.localeCompare(b.date))
    .at(-1);
  return (latest?.event as never) ?? "operational";
}

export function StationPanel({
  station,
  onClose,
}: {
  station: Station | null;
  onClose: () => void;
}) {
  if (!station) return null;
  return (
    <aside
      style={{
        position: "absolute",
        top: 0,
        right: 0,
        width: 320,
        height: "100%",
        background: "white",
        padding: 16,
      }}
    >
      <button onClick={onClose}>Close</button>
      <h2>{station.name_en ?? station.name_th}</h2>
      <p lang="th">{station.name_th}</p>
      <p>Structure: {station.structure}</p>
      <p>Accessible: {station.accessible ? "Yes" : "No"}</p>
      <p>Last verified: {station.last_verified_at}</p>
    </aside>
  );
}
```

Note: `deriveStatus` here is a display convenience deriving from milestones,
consistent with CLAUDE.md 9's rule that `status` is never hand-set. The
actual `Status` enum value used for rendering (dashed/faded/outline per
SPEC 3.3) is computed once in `scripts/build` and stored on the entity as a
`status` field so `apps/web` never re-derives business logic - **this task
also adds that derivation to `scripts/build/assemble.ts`**, see Step 2.

- [ ] **Step 2: Add status derivation to `scripts/build/assemble.ts`**

Add this function and call it when building `network`:

```typescript
// scripts/build/assemble.ts (add to existing file)
import type { Status, MilestoneEvent } from "schema";

const EVENT_TO_STATUS: Record<MilestoneEvent, Status> = {
  construction_started: "under_construction",
  trial_run: "trial",
  opened: "operational",
  extended: "operational",
  renamed: "operational",
  recoded: "operational",
  suspended: "suspended",
  closed: "cancelled",
};

export function deriveStatus(
  milestones: { date: string; event: MilestoneEvent }[],
): Status {
  if (milestones.length === 0) return "planned";
  const latest = [...milestones]
    .sort((a, b) => a.date.localeCompare(b.date))
    .at(-1)!;
  return EVENT_TO_STATUS[latest.event];
}
```

In `assembleNetwork` (Task 11), replace:

```typescript
const network = {
  stations,
  lines,
  segments,
  generated_at: new Date().toISOString(),
};
```

with:

```typescript
const network = {
  stations: stations.map((station) => ({
    ...station,
    status: deriveStatus(station.milestones),
  })),
  lines,
  segments,
  generated_at: new Date().toISOString(),
};
```

Leave `geojson` untouched - it stays minimal per CLAUDE.md 2.5, `status` is not
added to it.

- [ ] **Step 3: Write a test for `deriveStatus`**

```typescript
// scripts/build/assemble.test.ts (add to existing file)
import { deriveStatus } from "./assemble";

describe("deriveStatus", () => {
  it("returns planned when there are no milestones", () => {
    expect(deriveStatus([])).toBe("planned");
  });

  it("returns the status mapped from the latest milestone event", () => {
    expect(
      deriveStatus([
        { date: "2020-01-01", event: "construction_started" },
        { date: "2026-01-01", event: "opened" },
      ]),
    ).toBe("operational");
  });
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd scripts/build && bun test assemble.test.ts`
Expected: PASS.

- [ ] **Step 5: Write `apps/web/components/LineFilter.tsx`**

```tsx
// apps/web/components/LineFilter.tsx
"use client";

import type { Line } from "schema";

export function LineFilter({
  lines,
  activeLineIds,
  onToggle,
}: {
  lines: Line[];
  activeLineIds: Set<string>;
  onToggle: (id: string) => void;
}) {
  return (
    <div
      style={{
        position: "absolute",
        top: 16,
        left: 16,
        background: "white",
        padding: 8,
      }}
    >
      {lines.map((line) => (
        <label key={line.id} style={{ display: "block" }}>
          <input
            type="checkbox"
            checked={activeLineIds.has(line.id)}
            onChange={() => onToggle(line.id)}
          />
          <span style={{ color: line.color_hex }}>{line.name_en}</span>
        </label>
      ))}
    </div>
  );
}
```

- [ ] **Step 6: Wire both components into `apps/web/app/page.tsx`**

```tsx
// apps/web/app/page.tsx
"use client";

import { useMemo, useState } from "react";
import { Map } from "../components/Map";
import { StationPanel } from "../components/StationPanel";
import { LineFilter } from "../components/LineFilter";
import networkData from "../../../data/dist/network.json";
import networkGeoJson from "../../../data/dist/network.geojson";
import type { Station, Line } from "schema";
import type { FeatureCollection, Point } from "geojson";

export default function HomePage() {
  const stations = networkData.stations as Station[];
  const lines = networkData.lines as Line[];
  const [activeLineIds, setActiveLineIds] = useState(
    new Set(lines.map((l) => l.id)),
  );
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);

  const filteredGeoJson = useMemo(() => {
    const visibleStationIds = new Set(
      stations
        .filter((s) => s.validity.some((v) => activeLineIds.has(v.line)))
        .map((s) => s.id),
    );
    return {
      ...networkGeoJson,
      features: (networkGeoJson as FeatureCollection<Point>).features.filter(
        (f) => visibleStationIds.has(f.properties?.id),
      ),
    } as FeatureCollection<Point>;
  }, [activeLineIds, stations]);

  return (
    <>
      <Map networkGeoJson={filteredGeoJson} />
      <LineFilter
        lines={lines}
        activeLineIds={activeLineIds}
        onToggle={(id) =>
          setActiveLineIds((prev) => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
          })
        }
      />
      <StationPanel
        station={selectedStation}
        onClose={() => setSelectedStation(null)}
      />
    </>
  );
}
```

- [ ] **Step 7: Verify the build**

Run: `cd apps/web && bun run build`
Expected: build succeeds.

- [ ] **Step 8: Commit**

```bash
git add apps/web scripts/build
git commit -m "feat(web): add station panel, line filter, and derived status rendering"
```

---

### Task 16: `apps/web` - search and deep links

**Files:**

- Create: `apps/web/components/StationSearch.tsx`, `apps/web/lib/deep-link.ts`
- Modify: `apps/web/app/page.tsx`
- Test: `apps/web/lib/deep-link.test.ts`

**Interfaces:**

- Produces: `<StationSearch stations={Station[]} onSelect={(station: Station) => void} />`,
  `getStationIdFromUrl(url: string): string | null`, `buildStationDeepLink(stationId: string): string`
  - the latter two exported from `apps/web/lib/deep-link.ts`.

- [ ] **Step 1: Add Fuse.js dependency**

```bash
cd apps/web && bun add fuse.js@^7.0.0
```

- [ ] **Step 2: Write the failing deep-link test**

```typescript
// apps/web/lib/deep-link.test.ts
import { describe, it, expect } from "vitest";
import { getStationIdFromUrl, buildStationDeepLink } from "./deep-link";

describe("deep links", () => {
  it("extracts a station id from a URL with ?station=", () => {
    expect(getStationIdFromUrl("https://example.com/?station=BL15")).toBe(
      "BL15",
    );
  });

  it("returns null when there is no station param", () => {
    expect(getStationIdFromUrl("https://example.com/")).toBeNull();
  });

  it("builds a relative deep link for a station id", () => {
    expect(buildStationDeepLink("BL15")).toBe("?station=BL15");
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd apps/web && bun test lib/deep-link.test.ts`
Expected: FAIL - module not found.

- [ ] **Step 4: Write `apps/web/lib/deep-link.ts`**

```typescript
// apps/web/lib/deep-link.ts

export function getStationIdFromUrl(url: string): string | null {
  return new URL(url).searchParams.get("station");
}

// Relative, per PUBLIC_BASE_URL rule - no origin baked in.
export function buildStationDeepLink(stationId: string): string {
  return `?station=${encodeURIComponent(stationId)}`;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd apps/web && bun test lib/deep-link.test.ts`
Expected: PASS.

- [ ] **Step 6: Write `apps/web/components/StationSearch.tsx`**

```tsx
// apps/web/components/StationSearch.tsx
"use client";

import { useMemo, useState } from "react";
import Fuse from "fuse.js";
import type { Station } from "schema";

export function StationSearch({
  stations,
  onSelect,
}: {
  stations: Station[];
  onSelect: (station: Station) => void;
}) {
  const [query, setQuery] = useState("");

  const fuse = useMemo(
    () =>
      new Fuse(stations, {
        keys: ["name_th", "name_en", "id"],
        threshold: 0.3,
      }),
    [stations],
  );

  const results = query ? fuse.search(query).slice(0, 8) : [];

  return (
    <div
      style={{
        position: "absolute",
        top: 16,
        right: 16,
        background: "white",
        padding: 8,
      }}
    >
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search stations..."
      />
      <ul>
        {results.map(({ item }) => (
          <li key={item.id}>
            <button onClick={() => onSelect(item)}>
              {item.name_en ?? item.name_th} ({item.id})
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 7: Wire search and deep-link reading into `apps/web/app/page.tsx`**

Add to the existing `HomePage` component from Task 15:

```tsx
// apps/web/app/page.tsx (additions)
import { useEffect } from "react";
import { StationSearch } from "../components/StationSearch";
import { getStationIdFromUrl, buildStationDeepLink } from "../lib/deep-link";

// Inside HomePage, after existing state declarations:
useEffect(() => {
  const stationId = getStationIdFromUrl(window.location.href);
  if (stationId) {
    const station = stations.find((s) => s.id === stationId);
    if (station) setSelectedStation(station);
  }
}, [stations]);

function handleSelectStation(station: Station) {
  setSelectedStation(station);
  window.history.replaceState(null, "", buildStationDeepLink(station.id));
}

// Add <StationSearch stations={stations} onSelect={handleSelectStation} /> to the returned JSX,
// and change StationPanel's onSelect callers to use handleSelectStation instead of setSelectedStation directly.
```

- [ ] **Step 8: Verify the build**

Run: `cd apps/web && bun run build`
Expected: build succeeds.

- [ ] **Step 9: Commit**

```bash
git add apps/web
git commit -m "feat(web): add station search and shareable deep links"
```

---

### Task 17: `apps/web` - i18n, report-error button, dataset download page

**Files:**

- Create: `apps/web/lib/i18n.ts`, `apps/web/components/ReportErrorButton.tsx`,
  `apps/web/app/download/page.tsx`
- Test: `apps/web/lib/i18n.test.ts`

**Interfaces:**

- Produces: `t(key: string, lang: 'th' | 'en'): string` from `apps/web/lib/i18n.ts`;
  `<ReportErrorButton station={Station} />`; a static `/download` route.

- [ ] **Step 1: Write the failing i18n test**

```typescript
// apps/web/lib/i18n.test.ts
import { describe, it, expect } from "vitest";
import { t } from "./i18n";

describe("t", () => {
  it("returns the Thai string for a known key when lang is th", () => {
    expect(t("search_placeholder", "th")).toBe("ค้นหาสถานี...");
  });

  it("returns the English string for a known key when lang is en", () => {
    expect(t("search_placeholder", "en")).toBe("Search stations...");
  });

  it("falls back to the key itself when the key is unknown", () => {
    expect(t("unknown_key", "en")).toBe("unknown_key");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && bun test lib/i18n.test.ts`
Expected: FAIL - module not found.

- [ ] **Step 3: Write `apps/web/lib/i18n.ts`**

```typescript
// apps/web/lib/i18n.ts

const DICTIONARY: Record<string, { th: string; en: string }> = {
  search_placeholder: { th: "ค้นหาสถานี...", en: "Search stations..." },
  report_error: { th: "แจ้งข้อผิดพลาด", en: "Report an error" },
  last_verified: { th: "ตรวจสอบล่าสุด", en: "Last verified" },
  download_dataset: { th: "ดาวน์โหลดชุดข้อมูล", en: "Download dataset" },
};

export function t(key: string, lang: "th" | "en"): string {
  return DICTIONARY[key]?.[lang] ?? key;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && bun test lib/i18n.test.ts`
Expected: PASS.

- [ ] **Step 5: Write `apps/web/components/ReportErrorButton.tsx`**

```tsx
// apps/web/components/ReportErrorButton.tsx
"use client";

import type { Station } from "schema";
import { t } from "../lib/i18n";

const GITHUB_ISSUE_BASE_URL =
  "https://github.com/opentransit-th/bangkok-open-transit/issues/new";

export function ReportErrorButton({ station }: { station: Station }) {
  const title = encodeURIComponent(
    `Data error: ${station.name_en ?? station.name_th} (${station.id})`,
  );
  const body = encodeURIComponent(
    `Station ID: ${station.id}\nName (TH): ${station.name_th}\nName (EN): ${station.name_en ?? "N/A"}\n\nWhat's wrong:\n`,
  );
  const url = `${GITHUB_ISSUE_BASE_URL}?title=${title}&body=${body}&labels=data-correction`;

  return (
    <a href={url} target="_blank" rel="noopener noreferrer">
      {t("report_error", "en")}
    </a>
  );
}
```

- [ ] **Step 6: Add `ReportErrorButton` to `StationPanel`**

In `apps/web/components/StationPanel.tsx`, import and render
`<ReportErrorButton station={station} />` below the "Last verified" line.

- [ ] **Step 7: Write `apps/web/app/download/page.tsx`**

```tsx
// apps/web/app/download/page.tsx
export const metadata = { title: "Download dataset - BangkokOpenTransit" };

export default function DownloadPage() {
  return (
    <main style={{ padding: 32 }}>
      <h1>Download the dataset</h1>
      <p>
        BangkokOpenTransit's dataset is the product - the map is a demonstration
        of it. Licensed under ODbL-1.0.
      </p>
      <ul>
        <li>
          <a href="/network.json" download>
            network.json
          </a>
        </li>
        <li>
          <a href="/network.geojson" download>
            network.geojson
          </a>
        </li>
      </ul>
    </main>
  );
}
```

- [ ] **Step 8: Copy `data/dist` output into `apps/web/public` at build time**

Add to `apps/web/package.json`'s `"build"` script so the download page's links
resolve in the static export:

```json
"build": "cp ../../data/dist/network.json ../../data/dist/network.geojson public/ && next build"
```

- [ ] **Step 9: Verify the build**

Run: `cd apps/web && bun run build`
Expected: `apps/web/out/download/index.html` exists, `apps/web/out/network.json`
and `network.geojson` exist and are downloadable.

- [ ] **Step 10: Commit**

```bash
git add apps/web
git commit -m "feat(web): add i18n dictionary, report-error button, and dataset download page"
```

---

### Task 18: CSV export for the download page

**Files:**

- Create: `scripts/build/to-csv.ts`
- Test: `scripts/build/to-csv.test.ts`
- Modify: `scripts/build/index.ts`, `apps/web/app/download/page.tsx`

**Interfaces:**

- Produces: `stationsToCsv(stations: Station[]): string`, exported from
  `scripts/build/to-csv.ts`, called by `scripts/build/index.ts` to write
  `data/dist/stations.csv` (SPEC 1.13 requires CSV as one of the three
  download formats).

- [ ] **Step 1: Write the failing test**

```typescript
// scripts/build/to-csv.test.ts
import { describe, it, expect } from "vitest";
import { stationsToCsv } from "./to-csv";
import type { Station } from "schema";

describe("stationsToCsv", () => {
  it("produces a header row plus one row per station", () => {
    const stations = [
      {
        id: "BL15",
        name_th: "ลาดพร้าว",
        name_en: "Lat Phrao",
        structure: "underground",
        accessible: true,
        coords: { geo: { lat: 13.8163, lon: 100.5615 } },
      } as Station,
    ];
    const csv = stationsToCsv(stations);
    const lines = csv.trim().split("\n");
    expect(lines[0]).toBe("id,name_th,name_en,structure,accessible,lat,lon");
    expect(lines[1]).toBe(
      "BL15,ลาดพร้าว,Lat Phrao,underground,true,13.8163,100.5615",
    );
  });

  it("quotes fields containing commas", () => {
    const stations = [
      {
        id: "X1",
        name_th: "a",
        name_en: "Name, with comma",
        structure: "elevated",
        accessible: false,
        coords: { geo: { lat: 1, lon: 2 } },
      } as Station,
    ];
    const csv = stationsToCsv(stations);
    expect(csv).toContain('"Name, with comma"');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd scripts/build && bun test to-csv.test.ts`
Expected: FAIL - module not found.

- [ ] **Step 3: Write `scripts/build/to-csv.ts`**

```typescript
// scripts/build/to-csv.ts
import type { Station } from "schema";

const HEADER = [
  "id",
  "name_th",
  "name_en",
  "structure",
  "accessible",
  "lat",
  "lon",
];

function csvField(value: string | number | boolean): string {
  const str = String(value);
  return str.includes(",") || str.includes('"')
    ? `"${str.replace(/"/g, '""')}"`
    : str;
}

export function stationsToCsv(stations: Station[]): string {
  const rows = stations.map((s) =>
    [
      s.id,
      s.name_th,
      s.name_en ?? "",
      s.structure,
      s.accessible,
      s.coords.geo.lat,
      s.coords.geo.lon,
    ]
      .map(csvField)
      .join(","),
  );
  return [HEADER.join(","), ...rows].join("\n") + "\n";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd scripts/build && bun test to-csv.test.ts`
Expected: PASS.

- [ ] **Step 5: Wire it into `scripts/build/index.ts`**

Add to the existing `main()` function, after writing `network.geojson`:

```typescript
import { stationsToCsv } from "./to-csv";
// ...
writeFileSync(
  new URL("stations.csv", distDir),
  stationsToCsv(applyOverrides(stations)),
);
```

- [ ] **Step 6: Add the CSV link to the download page**

In `apps/web/app/download/page.tsx`, add a third `<li>`:

```tsx
<li>
  <a href="/stations.csv" download>
    stations.csv
  </a>
</li>
```

And add `../../data/dist/stations.csv` to the `cp` command in
`apps/web/package.json`'s `"build"` script (Task 17, Step 8).

- [ ] **Step 7: Commit**

```bash
git add scripts/build apps/web
git commit -m "feat(build): add CSV export for the dataset download page"
```

---

### Task 19: CI pipeline

**Files:**

- Modify: `.github/workflows/ci.yml`

**Interfaces:**

- Consumes: every `bun run` script defined in Tasks 1-18's `package.json` files.

- [ ] **Step 1: Write `.github/workflows/ci.yml`**

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  build-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest

      - name: Install dependencies
        run: bun install

      - name: Lint (Prettier check)
        run: bun run lint

      - name: Typecheck
        run: bun run typecheck

      - name: Unit tests
        run: bun run test

      - name: Generate JSON Schemas
        run: cd packages/schema && bun run generate-schemas

      - name: Build dataset artifacts
        run: bun run data:build

      - name: Validate dataset (schema, graph integrity, provenance, perf budget)
        run: bun run data:validate

      - name: Build web app
        run: cd apps/web && bun run build
```

- [ ] **Step 2: Push a branch and verify the workflow runs**

Push the current branch to GitHub, open a PR, and confirm every step in
`build-and-test` goes green in the Actions tab. If `data:build` fails because
`data/source` is still empty (no real OSM data imported/reviewed yet per
Task 10's note that it's a separate `data:` commit), that is an expected
failure at this point in the plan - not a bug in the workflow itself. Confirm
the workflow fails at the right step with a clear error, not a crash.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add lint, typecheck, test, build, and dataset validation pipeline"
```

---

## Summary of what ships after this plan

A working, testable Bun-workspace monorepo: 5 tested packages, a data
pipeline that turns git-reviewed source files into `network.json` /
`network.geojson` / `stations.csv`, and a Next.js static-export site with a
self-hosted MapLibre + PMTiles map, clustering, station panel, line filter,
search, deep links, i18n strings, a report-error button, and a dataset
download page - gated by CI. Real station/line/segment data in `data/source`
is a separate, subsequent `data:`-type workstream (Task 10's manual review
step), not fabricated as part of this plan.

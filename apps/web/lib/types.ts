// apps/web/lib/types.ts
import type { Station, Status } from "schema";

// `status` is computed once at build time in `scripts/build/assemble.ts`
// (per CLAUDE.md 9: never hand-set, never re-derived client-side) and
// attached to every station object in network.json.
//
// `StationSchema` now declares `status` itself (SPEC 3.2), so this is a
// no-op intersection rather than a widening one. It is kept as a named alias
// because it documents intent at every use site - these are stations read
// back from a built network.json, where `status` is guaranteed present and
// guaranteed derived - and because renaming it across every importer would
// be pure churn. `Station` remains the single source of truth for the shape
// (CLAUDE.md 4: "Never redefine an entity shape locally").
export type StationWithStatus = Station & { status: Status };

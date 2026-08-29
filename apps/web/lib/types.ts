// apps/web/lib/types.ts
import type { Station, Status } from 'schema';

// `status` is computed once at build time in `scripts/build/assemble.ts`
// (per CLAUDE.md 9: never hand-set, never re-derived client-side) and
// attached to every station object in network.json. The `Station` type from
// `packages/schema` intentionally does not declare `status` - it is a
// build-output field, not part of the entity's stored shape - so this
// intersection describes the actual shape of a station as read from
// network.json. Defined once here (CLAUDE.md 4: "Never redefine an entity
// shape locally") and imported by every component that touches it.
export type StationWithStatus = Station & { status: Status };

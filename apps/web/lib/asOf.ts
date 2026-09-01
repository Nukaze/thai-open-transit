// apps/web/lib/asOf.ts

interface ValidityWindow {
  from: string;
  to: string | null;
}

// Mirrors `filterAsOf`'s window check (packages/network-graph/src/temporal.ts)
// at the single-window level: `from` is inclusive, `to` is exclusive. Kept
// separate rather than reused because the map's line filter and date filter
// combine on the same validity entry (a station's line membership AND its
// open date both live on one window), which `filterAsOf`'s entity-level
// filter doesn't express.
export function isValidAt(window: ValidityWindow, date: string): boolean {
  return window.from <= date && (window.to === null || window.to > date);
}

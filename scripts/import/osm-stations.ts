// scripts/import/osm-stations.ts
import type { OsmElement } from "./osm-geometry";

/**
 * Matches a seed entry to its OSM node(s) either by `ref` (preferred) or by
 * exact Thai `name`, across both `railway=station` and
 * `public_transport=station|stop_position` nodes.
 *
 * Extracted from seed-1999.ts's original inline implementation so seed-2019.ts
 * (and any later era) can reuse the same ref/name matching and directional
 * stop_position averaging without re-deriving the bugs that motivated it: OSM
 * tags these lines inconsistently, so matching only `railway=station` nodes
 * silently misses lines that are mapped as `stop_position` pairs instead (see
 * the coordinate-averaging comment in `resolveCoords`).
 */
export type SeedStationRef = {
  /** OSM `ref` to look the node up by; omitted when matched on name instead. */
  osm_ref?: string;
  /** Exact OSM `name` (Thai) for stations mapped only as stop_positions. */
  osm_name?: string;
};

export function stationCandidates(
  seed: SeedStationRef,
  elements: OsmElement[],
): OsmElement[] {
  const isStationish = (e: OsmElement) =>
    e.type === "node" &&
    e.lat !== undefined &&
    (e.tags?.railway === "station" ||
      e.tags?.public_transport === "station" ||
      e.tags?.public_transport === "stop_position");

  // Both branches guard against an undefined key matching an absent tag:
  // `e.tags?.ref === undefined` is true for every untagged node, which is how
  // the coordinate bug happened and how `accessible` was later read off an
  // airport station in Suvarnabhumi.
  return seed.osm_ref !== undefined
    ? elements.filter((e) => isStationish(e) && e.tags?.ref === seed.osm_ref)
    : elements.filter(
        (e) =>
          isStationish(e) &&
          seed.osm_name !== undefined &&
          e.tags?.name === seed.osm_name,
      );
}

export function resolveCoords(
  seed: SeedStationRef,
  elements: OsmElement[],
  seedLabel: string,
): { lat: number; lon: number; name_th: string; name_en: string | null } {
  const candidates = stationCandidates(seed, elements);

  if (candidates.length === 0) {
    throw new Error(
      `No OSM station node found for seed station ${seedLabel} (ref=${seed.osm_ref ?? "-"}, name=${seed.osm_name ?? "-"})`,
    );
  }

  // A `railway=station` node is the surveyed station point; stop_positions sit
  // on the track, one per direction, so their midpoint is the better estimate
  // when no station node exists.
  const stationNode = candidates.find((e) => e.tags?.railway === "station");
  const used = stationNode ? [stationNode] : candidates;
  const named = stationNode ?? candidates[0]!;

  return {
    lat: used.reduce((sum, n) => sum + n.lat!, 0) / used.length,
    lon: used.reduce((sum, n) => sum + n.lon!, 0) / used.length,
    name_th: named.tags?.name ?? seedLabel,
    name_en: named.tags?.["name:en"] ?? null,
  };
}

/** True if any OSM candidate node for this seed is tagged wheelchair=yes. */
export function resolveAccessible(
  seed: SeedStationRef,
  elements: OsmElement[],
): boolean {
  return stationCandidates(seed, elements).some(
    (e) => e.tags?.wheelchair === "yes",
  );
}

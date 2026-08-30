import type { Station, Line, Segment, Status, MilestoneEvent } from "schema";
import {
  buildGraph,
  findOrphanStations,
  findDanglingSegments,
} from "network-graph";

// Fallback for a segment whose `line` has no matching Line record. The graph
// integrity check in scripts/validate is what flags that as a data error; this
// keeps the geojson renderable in the meantime rather than emitting `undefined`
// into a MapLibre `line-color`, which would throw at style-validation time.
const DEFAULT_LINE_COLOR = "#6b7280";

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

// Per CLAUDE.md 9: status is never hand-set, it is always derived from
// milestones[]. This runs once at build time so `apps/web` never re-derives
// business logic - it just renders the `status` field that ends up on each
// station in network.json.
export function deriveStatus(
  milestones: { date: string; event: MilestoneEvent }[],
): Status {
  if (milestones.length === 0) return "planned";
  const latest = [...milestones]
    .sort((a, b) => a.date.localeCompare(b.date))
    .at(-1)!;
  return EVENT_TO_STATUS[latest.event];
}

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
    stations: stations.map((station) => ({
      ...station,
      status: deriveStatus(station.milestones),
    })),
    lines,
    segments,
    generated_at: new Date().toISOString(),
  };

  const stationFeatures = stations.map((station) => ({
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
  }));

  // Segment geometry (SPEC 1.5) is emitted as LineString features so the map
  // can draw the network itself, not just its stations. `status` rides along
  // per feature because SPEC 3.3 styles each segment by status
  // (solid/dashed/faded/hidden), and `color` is denormalised from the
  // segment's line here so the renderer never needs a second lookup table
  // client-side - MapLibre paint expressions can only read feature properties.
  const stationById = new Map(stations.map((s) => [s.id, s]));
  const lineById = new Map(lines.map((l) => [l.id, l]));
  const segmentFeatures = segments.flatMap((segment) => {
    const from = stationById.get(segment.from_station);
    const to = stationById.get(segment.to_station);
    // Broken references are reported by scripts/validate's graph-integrity
    // check; this artifact-building step just skips them so partial data
    // still produces a usable geojson instead of throwing.
    if (!from || !to) return [];
    // Traced geometry when the segment has it, straight chord otherwise. The
    // chord is a deliberate fallback, not an error path: a segment added
    // before anyone has traced it still renders, just crudely, and
    // `geometry_source` on the entity says which one a consumer is looking at.
    const coordinates = segment.geometry?.coordinates ?? [
      [from.coords.geo.lon, from.coords.geo.lat],
      [to.coords.geo.lon, to.coords.geo.lat],
    ];

    return [
      {
        type: "Feature",
        geometry: { type: "LineString", coordinates },
        properties: {
          id: segment.id,
          line: segment.line,
          status: deriveStatus(segment.milestones),
          color: lineById.get(segment.line)?.color_hex ?? DEFAULT_LINE_COLOR,
          geometry_source: segment.geometry_source,
        },
      },
    ];
  });

  const geojson = {
    type: "FeatureCollection",
    features: [...stationFeatures, ...segmentFeatures],
  };

  return { network, geojson };
}

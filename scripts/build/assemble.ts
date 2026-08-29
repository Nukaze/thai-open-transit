import type { Station, Line, Segment, Status, MilestoneEvent } from "schema";
import {
  buildGraph,
  findOrphanStations,
  findDanglingSegments,
} from "network-graph";

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

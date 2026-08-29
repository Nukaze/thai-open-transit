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

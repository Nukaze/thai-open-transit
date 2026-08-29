import type { Station, Segment } from 'schema';

export interface NetworkGraph {
  stations: Map<string, Station>;
  segments: Map<string, Segment>;
  adjacency: Map<string, Set<string>>;
}

export function buildGraph(stations: Station[], segments: Segment[]): NetworkGraph {
  const stationMap = new Map(stations.map((s) => [s.id, s]));
  const segmentMap = new Map(segments.map((s) => [s.id, s]));
  const adjacency = new Map<string, Set<string>>();

  for (const segment of segments) {
    if (!adjacency.has(segment.from_station)) adjacency.set(segment.from_station, new Set());
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
        !graph.stations.has(segment.from_station) || !graph.stations.has(segment.to_station),
    )
    .map((segment) => segment.id)
    .sort();
}

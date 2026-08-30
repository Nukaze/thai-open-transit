// scripts/import/osm-geometry.ts
import {
  simplifyLine,
  roundLine,
  distanceMeters,
  lineLengthMeters,
} from "geo-utils";
import type { Position } from "geo-utils";

export type OsmElement = {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  nodes?: number[];
  members?: { type: string; ref: number; role: string }[];
  tags?: Record<string, string>;
};

type Graph = Map<number, { to: number; weight: number }[]>;

/**
 * Builds an undirected node graph from a set of OSM ways.
 *
 * Why a graph and not a simple concatenation of the route relation's ways:
 * relation member order is only as good as the mapping, and this extract is
 * bbox-clipped, so the Sukhumvit relation's ways do not chain end-to-end.
 * A graph plus shortest path is indifferent to member order, to way direction,
 * and to gaps that route around - it is what the established GTFS-shapes-from-
 * OSM tools do for the same reason.
 */
export function buildGraph(
  ways: OsmElement[],
  nodes: Map<number, OsmElement>,
): Graph {
  const graph: Graph = new Map();
  const link = (a: number, b: number, weight: number) => {
    if (!graph.has(a)) graph.set(a, []);
    graph.get(a)!.push({ to: b, weight });
  };

  for (const way of ways) {
    const ids = (way.nodes ?? []).filter((id) => nodes.has(id));
    for (let i = 1; i < ids.length; i++) {
      const a = ids[i - 1]!;
      const b = ids[i]!;
      const weight = distanceMeters(
        positionOf(nodes.get(a)!),
        positionOf(nodes.get(b)!),
      );
      link(a, b, weight);
      link(b, a, weight);
    }
  }
  return graph;
}

export function positionOf(node: OsmElement): Position {
  return [node.lon!, node.lat!];
}

/** Graph node closest to `point`, used to attach a station to the track. */
export function nearestGraphNode(
  graph: Graph,
  nodes: Map<number, OsmElement>,
  point: Position,
): { id: number; distanceMeters: number } {
  let best = { id: -1, distanceMeters: Number.POSITIVE_INFINITY };
  for (const id of graph.keys()) {
    const d = distanceMeters(positionOf(nodes.get(id)!), point);
    if (d < best.distanceMeters) best = { id, distanceMeters: d };
  }
  return best;
}

/** Dijkstra. Returns node ids from `start` to `goal`, or null if disconnected. */
export function shortestPath(
  graph: Graph,
  start: number,
  goal: number,
): number[] | null {
  const distance = new Map<number, number>([[start, 0]]);
  const previous = new Map<number, number>();
  const visited = new Set<number>();
  // Linear-scan frontier rather than a binary heap: these graphs are ~1k nodes
  // per line and this runs once at import, so the constant factor is irrelevant
  // next to the dependency it would cost.
  const frontier = new Set<number>([start]);

  while (frontier.size > 0) {
    let current = -1;
    let currentDistance = Number.POSITIVE_INFINITY;
    for (const id of frontier) {
      const d = distance.get(id) ?? Number.POSITIVE_INFINITY;
      if (d < currentDistance) {
        current = id;
        currentDistance = d;
      }
    }
    frontier.delete(current);
    if (current === goal) break;
    visited.add(current);

    for (const edge of graph.get(current) ?? []) {
      if (visited.has(edge.to)) continue;
      const candidate = currentDistance + edge.weight;
      if (candidate < (distance.get(edge.to) ?? Number.POSITIVE_INFINITY)) {
        distance.set(edge.to, candidate);
        previous.set(edge.to, current);
        frontier.add(edge.to);
      }
    }
  }

  if (!distance.has(goal)) return null;
  const path = [goal];
  while (path[path.length - 1] !== start) {
    const step = previous.get(path[path.length - 1]!);
    if (step === undefined) return null;
    path.push(step);
  }
  return path.reverse();
}

export const SIMPLIFY_TOLERANCE_METERS = 4;

/**
 * A traced path longer than this multiple of the straight chord did not follow
 * the track between the two stations - it crossed to the opposite-direction
 * track and doubled back, or routed around a gap in the extract. Real transit
 * segments sit between 1.0 and about 1.4; the first version of this module
 * pooled both directions of a line into one graph and produced a 47 km trace
 * for a 1 km chord, which is what this guard exists to reject.
 */
export const MAX_DETOUR_RATIO = 1.8;

/**
 * A path SHORTER than the chord means the two ends did not really connect -
 * both stations attached to the same tiny disjoint way (the "supplementary
 * route" relations in this extract do exactly that, yielding zero-length
 * paths). Geometry is only accepted when it plausibly spans the gap.
 */
export const MIN_SPAN_RATIO = 0.9;

/** How far a station may sit from the track it is attached to. */
export const MAX_ATTACH_METERS = 150;

export type TraceCandidate = { wayRefs: number[]; graph: Graph };

export type Trace = {
  coordinates: Position[];
  wayRefs: number[];
  lengthMeters: number;
  detourRatio: number;
  attachMeters: number;
};

function traceWithin(
  candidate: TraceCandidate,
  nodes: Map<number, OsmElement>,
  from: Position,
  to: Position,
): Trace | null {
  const start = nearestGraphNode(candidate.graph, nodes, from);
  const goal = nearestGraphNode(candidate.graph, nodes, to);
  if (start.id === -1 || goal.id === -1 || start.id === goal.id) return null;

  const attachMeters = Math.max(start.distanceMeters, goal.distanceMeters);
  if (attachMeters > MAX_ATTACH_METERS) return null;

  const path = shortestPath(candidate.graph, start.id, goal.id);
  if (path === null || path.length < 2) return null;

  const full = path.map((id) => positionOf(nodes.get(id)!));
  const lengthMeters = lineLengthMeters(full);
  const chord = distanceMeters(from, to);
  const detourRatio =
    chord === 0 ? Number.POSITIVE_INFINITY : lengthMeters / chord;
  if (detourRatio > MAX_DETOUR_RATIO || detourRatio < MIN_SPAN_RATIO)
    return null;

  return {
    coordinates: roundLine(simplifyLine(full, SIMPLIFY_TOLERANCE_METERS)),
    wayRefs: candidate.wayRefs,
    lengthMeters,
    detourRatio,
    attachMeters,
  };
}

/**
 * Traces the track between two stations, trying each candidate route relation
 * separately and keeping the tightest acceptable path.
 *
 * Separately, not pooled: a line's two directions are two parallel tracks that
 * only meet at crossovers, so a graph containing both lets the shortest path
 * hop between them and take a long detour. One graph per relation keeps a
 * trace on a single track.
 *
 * Returns null when nothing qualifies, which is a reportable data gap, not a
 * failure - the caller falls back to a straight chord.
 */
export function chooseTrace(
  candidates: TraceCandidate[],
  nodes: Map<number, OsmElement>,
  from: Position,
  to: Position,
): Trace | null {
  let best: Trace | null = null;
  for (const candidate of candidates) {
    const trace = traceWithin(candidate, nodes, from, to);
    if (trace === null) continue;
    if (best === null || trace.detourRatio < best.detourRatio) best = trace;
  }
  return best;
}

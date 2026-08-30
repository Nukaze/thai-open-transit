import { describe, it, expect } from "vitest";
import {
  buildGraph,
  chooseTrace,
  shortestPath,
  nearestGraphNode,
  MAX_DETOUR_RATIO,
  type OsmElement,
  type TraceCandidate,
} from "./osm-geometry";

/** Five nodes ~100 m apart along a straight east-west line. */
function straightNodes(startId: number, lonStart: number): OsmElement[] {
  return Array.from({ length: 5 }, (_, i) => ({
    type: "node",
    id: startId + i,
    lon: lonStart + i * 0.001,
    lat: 13.75,
  }));
}

function nodeMap(elements: OsmElement[]): Map<number, OsmElement> {
  return new Map(elements.map((e) => [e.id, e]));
}

const NODES = straightNodes(1, 100.5);
const WAY: OsmElement = { type: "way", id: 900, nodes: [1, 2, 3, 4, 5] };

describe("buildGraph / shortestPath", () => {
  it("links consecutive way nodes in both directions", () => {
    const graph = buildGraph([WAY], nodeMap(NODES));
    expect(shortestPath(graph, 1, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(shortestPath(graph, 5, 1)).toEqual([5, 4, 3, 2, 1]);
  });

  it("returns null when the two nodes are in disconnected components", () => {
    const far = straightNodes(10, 100.9);
    const graph = buildGraph(
      [WAY, { type: "way", id: 901, nodes: [10, 11, 12, 13, 14] }],
      nodeMap([...NODES, ...far]),
    );
    expect(shortestPath(graph, 1, 14)).toBeNull();
  });
});

describe("nearestGraphNode", () => {
  it("attaches a point to the closest node and reports the distance", () => {
    const graph = buildGraph([WAY], nodeMap(NODES));
    const nearest = nearestGraphNode(
      graph,
      nodeMap(NODES),
      [100.5031, 13.7501],
    );
    expect(nearest.id).toBe(4);
    expect(nearest.distanceMeters).toBeLessThan(30);
  });
});

describe("chooseTrace", () => {
  const nodes = nodeMap(NODES);
  const candidate: TraceCandidate = {
    wayRefs: [900],
    graph: buildGraph([WAY], nodes),
  };

  it("traces the track between two stations", () => {
    const trace = chooseTrace(
      [candidate],
      nodes,
      [100.5, 13.75],
      [100.504, 13.75],
    );
    expect(trace).not.toBeNull();
    expect(trace!.wayRefs).toEqual([900]);
    expect(trace!.detourRatio).toBeCloseTo(1, 2);
  });

  // The 47 km-for-1 km regression: pooling both directions of a line let the
  // path cross to the opposite track and double back.
  it("rejects a path that detours far beyond the chord", () => {
    const detourNodes = nodeMap([
      ...NODES,
      { type: "node", id: 50, lon: 100.5005, lat: 13.79 },
    ]);
    const detour: TraceCandidate = {
      wayRefs: [901],
      graph: buildGraph(
        [{ type: "way", id: 901, nodes: [1, 50, 5] }],
        detourNodes,
      ),
    };
    const trace = chooseTrace(
      [detour],
      detourNodes,
      [100.5, 13.75],
      [100.504, 13.75],
    );
    expect(trace).toBeNull();
  });

  it("prefers the tightest candidate when several qualify", () => {
    const slightlyLonger: TraceCandidate = {
      wayRefs: [902],
      graph: buildGraph(
        [{ type: "way", id: 902, nodes: [1, 2, 3, 4, 5] }],
        nodes,
      ),
    };
    const trace = chooseTrace(
      [candidate, slightlyLonger],
      nodes,
      [100.5, 13.75],
      [100.504, 13.75],
    );
    expect(trace!.detourRatio).toBeLessThanOrEqual(MAX_DETOUR_RATIO);
  });

  it("rejects a station sitting too far from any track", () => {
    const trace = chooseTrace(
      [candidate],
      nodes,
      [100.5, 13.9], // ~17 km off the line
      [100.504, 13.75],
    );
    expect(trace).toBeNull();
  });
});

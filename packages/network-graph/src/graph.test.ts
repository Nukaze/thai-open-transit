import { describe, it, expect } from "vitest";
import { buildGraph, findOrphanStations, findDanglingSegments } from "./graph";
import type { Station, Segment } from "schema";

function makeStation(id: string): Station {
  return {
    id,
    name_th: id,
    name_en: id,
    code_history: [{ code: id, from: "2026-01-01", to: null }],
    structure: "elevated",
    accessible: true,
    coords: { geo: { lat: 13.75, lon: 100.5 } },
    validity: [],
    milestones: [],
    status: "operational",
    confidence: "high",
    last_verified_at: "2026-07-01",
  };
}

function makeSegment(from: string, to: string): Segment {
  return {
    id: `${from}__${to}`,
    line: "TEST_LINE",
    from_station: from,
    to_station: to,
    milestones: [],
    confidence: "high",
    last_verified_at: "2026-07-01",
  };
}

describe("buildGraph", () => {
  it("builds adjacency from segments", () => {
    const stations = [makeStation("A"), makeStation("B"), makeStation("C")];
    const segments = [makeSegment("A", "B"), makeSegment("B", "C")];
    const graph = buildGraph(stations, segments);
    expect(graph.adjacency.get("A")?.has("B")).toBe(true);
    expect(graph.adjacency.get("B")?.has("C")).toBe(true);
  });

  it("detects an orphan station with no segments", () => {
    const stations = [
      makeStation("A"),
      makeStation("B"),
      makeStation("ORPHAN"),
    ];
    const segments = [makeSegment("A", "B")];
    const graph = buildGraph(stations, segments);
    expect(findOrphanStations(graph)).toEqual(["ORPHAN"]);
  });

  it("detects a dangling segment referencing a missing station", () => {
    const stations = [makeStation("A")];
    const segments = [makeSegment("A", "MISSING")];
    const graph = buildGraph(stations, segments);
    expect(findDanglingSegments(graph)).toEqual(["A__MISSING"]);
  });
});

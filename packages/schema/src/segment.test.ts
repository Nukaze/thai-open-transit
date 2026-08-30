import { describe, it, expect } from "vitest";
import { SegmentSchema } from "./segment";

const BASE = {
  id: "BL15__BL16",
  line: "MRT_BLUE",
  from_station: "BL15",
  to_station: "BL16",
  geometry: null,
  geometry_source: "straight" as const,
  osm_way_refs: [],
  validity: [{ from: "2004-07-03", to: null }],
  milestones: [],
  confidence: "high" as const,
  last_verified_at: "2026-07-01",
};

describe("SegmentSchema", () => {
  it("accepts a valid segment and derives id shape", () => {
    expect(SegmentSchema.safeParse(BASE).success).toBe(true);
  });

  it("rejects an id that does not match {FROM}__{TO}", () => {
    expect(SegmentSchema.safeParse({ ...BASE, id: "BL15-BL16" }).success).toBe(
      false,
    );
  });

  it("accepts traced geometry with its OSM provenance", () => {
    const traced = {
      ...BASE,
      geometry: {
        type: "LineString",
        coordinates: [
          [100.5, 13.7],
          [100.51, 13.71],
        ],
      },
      geometry_source: "osm",
      osm_way_refs: [791625654],
    };
    expect(SegmentSchema.safeParse(traced).success).toBe(true);
  });

  // The chord fallback and a real trace must not be confusable: a consumer
  // deciding whether a line is survey-accurate reads `geometry_source`, so it
  // has to agree with whether geometry actually exists.
  it("rejects geometry_source 'osm' with null geometry", () => {
    expect(
      SegmentSchema.safeParse({ ...BASE, geometry_source: "osm" }).success,
    ).toBe(false);
  });

  it("rejects geometry_source 'straight' alongside real geometry", () => {
    const contradictory = {
      ...BASE,
      geometry: {
        type: "LineString",
        coordinates: [
          [100.5, 13.7],
          [100.51, 13.71],
        ],
      },
    };
    expect(SegmentSchema.safeParse(contradictory).success).toBe(false);
  });

  it("rejects a LineString with fewer than two positions", () => {
    const degenerate = {
      ...BASE,
      geometry: { type: "LineString", coordinates: [[100.5, 13.7]] },
      geometry_source: "osm",
    };
    expect(SegmentSchema.safeParse(degenerate).success).toBe(false);
  });
});

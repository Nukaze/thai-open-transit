import { describe, it, expect } from "vitest";
import { assembleNetwork, deriveStatus } from "./assemble";
import type { Station, Line, Segment } from "schema";

type GeoFeature = {
  type: string;
  geometry: { type: string; coordinates: unknown };
  properties: Record<string, unknown>;
};

function makeStation(id: string): Station {
  return {
    id,
    name_th: id,
    name_en: id,
    code_history: [{ code: id, from: "2026-01-01", to: null }],
    structure: "elevated",
    accessible: true,
    coords: { geo: { lat: 13.75, lon: 100.5 } },
    validity: [{ line: "TEST_LINE", from: "2026-01-01", to: null }],
    milestones: [],
    confidence: "high",
    last_verified_at: "2026-07-01",
  };
}

describe("assembleNetwork", () => {
  it("produces a network object and a GeoJSON FeatureCollection", () => {
    const stations = [makeStation("A"), makeStation("B")];
    const lines: Line[] = [
      {
        id: "TEST_LINE",
        operator: "TEST",
        name_th: "ทดสอบ",
        name_en: "Test Line",
        color_hex: "#000000",
        milestones: [],
        confidence: "high",
        last_verified_at: "2026-07-01",
      },
    ];
    const segments: Segment[] = [
      {
        id: "A__B",
        line: "TEST_LINE",
        from_station: "A",
        to_station: "B",
        milestones: [],
        confidence: "high",
        last_verified_at: "2026-07-01",
      },
    ];

    const { network, geojson } = assembleNetwork(stations, lines, segments);

    expect(network).toHaveProperty("stations");
    expect(network).toHaveProperty("lines");
    expect(network).toHaveProperty("segments");
    expect(geojson).toMatchObject({ type: "FeatureCollection" });
    // 2 station Points + 1 segment LineString
    expect((geojson as { features: unknown[] }).features).toHaveLength(3);
  });

  it("emits a LineString feature per segment with endpoint coords, derived status and line color", () => {
    const a: Station = {
      ...makeStation("A"),
      coords: { geo: { lat: 13.75, lon: 100.5 } },
    };
    const b: Station = {
      ...makeStation("B"),
      coords: { geo: { lat: 13.8, lon: 100.6 } },
    };
    const lines: Line[] = [
      {
        id: "TEST_LINE",
        operator: "TEST",
        name_th: "ทดสอบ",
        name_en: "Test Line",
        color_hex: "#ff0000",
        milestones: [],
        confidence: "high",
        last_verified_at: "2026-07-01",
      },
    ];
    const segments: Segment[] = [
      {
        id: "A__B",
        line: "TEST_LINE",
        from_station: "A",
        to_station: "B",
        milestones: [
          {
            date: "2026-01-01",
            date_precision: "exact",
            event: "construction_started",
            source_refs: [{ url: "https://example.com", title: "Example" }],
          },
        ],
        confidence: "high",
        last_verified_at: "2026-07-01",
      },
    ];

    const { geojson } = assembleNetwork([a, b], lines, segments);
    const features = (geojson as { features: GeoFeature[] }).features;
    const lineFeatures = features.filter(
      (f) => f.geometry.type === "LineString",
    );

    expect(lineFeatures).toHaveLength(1);
    expect(lineFeatures[0]).toEqual({
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: [
          [100.5, 13.75],
          [100.6, 13.8],
        ],
      },
      properties: {
        id: "A__B",
        line: "TEST_LINE",
        status: "under_construction",
        color: "#ff0000",
      },
    });
  });

  it("throws if graph integrity check finds an orphan or dangling segment", () => {
    const stations = [makeStation("A")];
    const segments: Segment[] = [
      {
        id: "A__MISSING",
        line: "TEST_LINE",
        from_station: "A",
        to_station: "MISSING",
        milestones: [],
        confidence: "high",
        last_verified_at: "2026-07-01",
      },
    ];
    expect(() => assembleNetwork(stations, [], segments)).toThrow(
      /dangling segment/i,
    );
  });

  it("attaches a `status` field derived from each station's milestones", () => {
    const withMilestone: Station = {
      ...makeStation("C"),
      milestones: [
        {
          date: "2026-01-01",
          date_precision: "exact",
          event: "opened",
          source_refs: [{ url: "https://example.com", title: "Example" }],
        },
      ],
    };
    const stations = [makeStation("A"), withMilestone];
    const segments: Segment[] = [
      {
        id: "A__C",
        line: "TEST_LINE",
        from_station: "A",
        to_station: "C",
        milestones: [],
        confidence: "high",
        last_verified_at: "2026-07-01",
      },
    ];

    const { network } = assembleNetwork(stations, [], segments);
    const net = network as { stations: { id: string; status: string }[] };

    expect(net.stations.find((s) => s.id === "A")?.status).toBe("planned");
    expect(net.stations.find((s) => s.id === "C")?.status).toBe("operational");
  });
});

describe("deriveStatus", () => {
  it("returns planned when there are no milestones", () => {
    expect(deriveStatus([])).toBe("planned");
  });

  it("returns the status mapped from the latest milestone event", () => {
    expect(
      deriveStatus([
        { date: "2020-01-01", event: "construction_started" },
        { date: "2026-01-01", event: "opened" },
      ]),
    ).toBe("operational");
  });
});

import { describe, it, expect } from "vitest";
import { StationSchema } from "./station";

describe("StationSchema", () => {
  it("accepts a valid station record", () => {
    const station = {
      id: "BL15",
      name_th: "ลาดพร้าว",
      name_en: "Lat Phrao",
      code_history: [{ code: "BL15", from: "2004-07-03", to: null }],
      interchange_group: "LATPHRAO",
      structure: "underground",
      accessible: true,
      coords: {
        geo: { lat: 13.8163, lon: 100.5615 },
      },
      validity: [{ line: "MRT_BLUE", from: "2004-07-03", to: null }],
      milestones: [
        {
          date: "2004-07-03",
          date_precision: "exact",
          event: "opened",
          line: "MRT_BLUE",
          source_refs: [
            {
              url: "https://example.com/mrta-press-release",
              title: "MRTA press release",
              published_at: "2004-07-03",
            },
          ],
        },
      ],
      status: "operational",
      confidence: "high",
      last_verified_at: "2026-07-01",
    };
    expect(StationSchema.safeParse(station).success).toBe(true);
  });

  it("rejects a station with an empty source_refs array on a milestone", () => {
    const station = {
      id: "BL15",
      name_th: "ลาดพร้าว",
      name_en: "Lat Phrao",
      code_history: [{ code: "BL15", from: "2004-07-03", to: null }],
      interchange_group: "LATPHRAO",
      structure: "underground",
      accessible: true,
      coords: { geo: { lat: 13.8163, lon: 100.5615 } },
      validity: [{ line: "MRT_BLUE", from: "2004-07-03", to: null }],
      milestones: [
        {
          date: "2004-07-03",
          date_precision: "exact",
          event: "opened",
          line: "MRT_BLUE",
          source_refs: [],
        },
      ],
      status: "operational",
      confidence: "high",
      last_verified_at: "2026-07-01",
    };
    expect(StationSchema.safeParse(station).success).toBe(false);
  });

  it("rejects an unknown structure value", () => {
    const station = {
      id: "BL15",
      name_th: "ลาดพร้าว",
      name_en: "Lat Phrao",
      code_history: [{ code: "BL15", from: "2004-07-03", to: null }],
      interchange_group: "LATPHRAO",
      structure: "floating",
      accessible: true,
      coords: { geo: { lat: 13.8163, lon: 100.5615 } },
      validity: [],
      milestones: [],
      status: "operational",
      confidence: "high",
      last_verified_at: "2026-07-01",
    };
    expect(StationSchema.safeParse(station).success).toBe(false);
  });

  it("rejects disputed date_precision with only 1 source_refs", () => {
    const station = {
      id: "BL15",
      name_th: "ลาดพร้าว",
      name_en: "Lat Phrao",
      code_history: [{ code: "BL15", from: "2004-07-03", to: null }],
      interchange_group: "LATPHRAO",
      structure: "underground",
      accessible: true,
      coords: { geo: { lat: 13.8163, lon: 100.5615 } },
      validity: [{ line: "MRT_BLUE", from: "2004-07-03", to: null }],
      milestones: [
        {
          date: "2004-07-03",
          date_precision: "disputed",
          event: "opened",
          line: "MRT_BLUE",
          source_refs: [
            {
              url: "https://example.com/mrta-press-release",
              title: "MRTA press release",
              published_at: "2004-07-03",
            },
          ],
        },
      ],
      status: "operational",
      confidence: "high",
      last_verified_at: "2026-07-01",
    };
    expect(StationSchema.safeParse(station).success).toBe(false);
  });

  it("accepts disputed date_precision with 2 source_refs", () => {
    const station = {
      id: "BL15",
      name_th: "ลาดพร้าว",
      name_en: "Lat Phrao",
      code_history: [{ code: "BL15", from: "2004-07-03", to: null }],
      interchange_group: "LATPHRAO",
      structure: "underground",
      accessible: true,
      coords: { geo: { lat: 13.8163, lon: 100.5615 } },
      validity: [{ line: "MRT_BLUE", from: "2004-07-03", to: null }],
      milestones: [
        {
          date: "2004-07-03",
          date_precision: "disputed",
          event: "opened",
          line: "MRT_BLUE",
          source_refs: [
            {
              url: "https://example.com/mrta-press-release",
              title: "MRTA press release",
              published_at: "2004-07-03",
            },
            {
              url: "https://example.com/wikipedia-entry",
              title: "Wikipedia entry on MRT Blue Line",
              published_at: "2010-05-15",
            },
          ],
        },
      ],
      status: "operational",
      confidence: "high",
      last_verified_at: "2026-07-01",
    };
    expect(StationSchema.safeParse(station).success).toBe(true);
  });
});

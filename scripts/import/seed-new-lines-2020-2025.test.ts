import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import {
  StationSchema,
  LineSchema,
  SegmentSchema,
  type Station,
  type Segment,
} from "schema";

// Reads the committed seed output rather than data/dist, which is gitignored
// and absent in a fresh clone.
function loadDir<T>(dir: string, parse: (raw: unknown) => T): T[] {
  const url = new URL(`../../data/source/${dir}/`, import.meta.url);
  return readdirSync(url)
    .filter((name) => name.endsWith(".json"))
    .map((name) =>
      parse(JSON.parse(readFileSync(new URL(name, url), "utf-8"))),
    );
}

const stations = loadDir("stations", (r) => StationSchema.parse(r));
const segments = loadDir("segments", (r) => SegmentSchema.parse(r));
const lines = loadDir("lines", (r) => LineSchema.parse(r));

const NEW_LINES = ["BTS_GOLD", "MRT_YELLOW", "MRT_PINK"];

// `from` inclusive, `to` exclusive: same rule as filterAsOf in network-graph.
const isValidAt = (w: { from: string; to: string | null }, date: string) =>
  w.from <= date && (w.to === null || w.to > date);

const stationsOnLine = (line: string, date: string): Station[] =>
  stations.filter((s) =>
    s.validity.some((v) => v.line === line && isValidAt(v, date)),
  );
const segmentsOnLine = (line: string, date: string): Segment[] =>
  segments.filter(
    (s) => s.line === line && s.validity.some((v) => isValidAt(v, date)),
  );

describe("Gold, Yellow and Pink seed data", () => {
  it("defines all three lines with full milestone provenance", () => {
    for (const id of NEW_LINES) {
      const line = lines.find((l) => l.id === id);
      expect(line, id).toBeDefined();
      expect(line!.milestones.length).toBeGreaterThan(0);
    }
  });

  // Gold opened on 2020-12-16, so only Yellow and Pink are absent in 2022.
  it("has neither Yellow nor Pink as of 2022-12-31, but already has Gold", () => {
    for (const id of ["MRT_YELLOW", "MRT_PINK"]) {
      expect(stationsOnLine(id, "2022-12-31"), id).toHaveLength(0);
      expect(segmentsOnLine(id, "2022-12-31"), id).toHaveLength(0);
    }
    expect(stationsOnLine("BTS_GOLD", "2022-12-31")).toHaveLength(3);
    expect(segmentsOnLine("BTS_GOLD", "2022-12-31")).toHaveLength(2);
  });

  it("has Gold only from its 2020-12-16 opening", () => {
    expect(stationsOnLine("BTS_GOLD", "2020-12-15")).toHaveLength(0);
    expect(stationsOnLine("BTS_GOLD", "2020-12-16").map((s) => s.id)).toEqual([
      "G1",
      "G2",
      "G3",
    ]);
  });

  it("has Yellow open but not Pink as of 2023-12-31", () => {
    expect(stationsOnLine("MRT_YELLOW", "2023-12-31")).toHaveLength(23);
    expect(segmentsOnLine("MRT_YELLOW", "2023-12-31")).toHaveLength(22);
    expect(stationsOnLine("MRT_PINK", "2023-12-31")).toHaveLength(0);
  });

  it("counts Yellow as open from revenue service on 2023-07-03, not from its trial", () => {
    expect(stationsOnLine("MRT_YELLOW", "2023-07-02")).toHaveLength(0);
    expect(stationsOnLine("MRT_YELLOW", "2023-07-03")).toHaveLength(23);
  });

  it("opens Pink's 30 main-line stations on 2024-01-07 without the branch", () => {
    const onOpening = stationsOnLine("MRT_PINK", "2024-01-07").map((s) => s.id);
    expect(onOpening).toHaveLength(30);
    expect(onOpening).not.toContain("MT01");
    expect(onOpening).not.toContain("MT02");
    expect(segmentsOnLine("MRT_PINK", "2024-01-07")).toHaveLength(29);
  });

  it("has the Pink branch as of 2025-12-31 but not before 2025-06-17", () => {
    const after = stationsOnLine("MRT_PINK", "2025-12-31").map((s) => s.id);
    expect(after).toHaveLength(32);
    expect(after).toEqual(expect.arrayContaining(["MT01", "MT02"]));
    expect(segmentsOnLine("MRT_PINK", "2025-12-31").map((s) => s.id)).toEqual(
      expect.arrayContaining(["PK10__MT01", "MT01__MT02"]),
    );

    // The branch ran a free trial from 2025-05-20, but is not "open" until
    // revenue service starts.
    expect(stationsOnLine("MRT_PINK", "2025-06-16")).toHaveLength(30);
  });

  it("attaches the branch to PK10 on the Pink line, not to a new line", () => {
    const branch = segments.find((s) => s.id === "PK10__MT01");
    expect(branch?.line).toBe("MRT_PINK");
    expect(branch?.from_station).toBe("PK10");
    expect(segments.find((s) => s.id === "MT01__MT02")?.line).toBe("MRT_PINK");
  });

  it("dates a Yellow segment by the later of its two stations' trial stage", () => {
    const trialOf = (id: string) =>
      segments
        .find((s) => s.id === id)!
        .milestones.find((m) => m.event === "trial_run")!.date;
    expect(trialOf("YL11__YL12")).toBe("2023-06-03");
    // YL10 only joined the trial on 2023-06-12, so the segment into YL11
    // cannot be dated by YL11's earlier 2023-06-03 trial.
    expect(trialOf("YL10__YL11")).toBe("2023-06-12");
    expect(trialOf("YL01__YL02")).toBe("2023-06-19");
  });

  it("does not give Gold's G1 the BTS Silom S7 coordinates", () => {
    const g1 = stations.find((s) => s.id === "G1")!;
    const s7 = stations.find((s) => s.id === "S7")!;
    expect(g1.name_en).toBe(s7.name_en);
    expect(g1.coords.geo).not.toEqual(s7.coords.geo);
  });

  it("leaves interchange_group null on every new station", () => {
    const ids = new Set(NEW_LINES);
    for (const s of stations.filter((st) =>
      st.validity.some((v) => ids.has(v.line)),
    )) {
      expect(s.interchange_group ?? null, s.id).toBeNull();
    }
  });
});

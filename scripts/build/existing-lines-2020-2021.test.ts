import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { StationSchema, SegmentSchema } from "schema";
import { filterAsOf } from "network-graph";

// Reads the committed data/source JSON (not data/dist, which is gitignored and
// absent on a fresh clone) and asserts the temporal behaviour of the 2020-2021
// additions to the existing lines (CLAUDE.md 6, testing priority 1).
const sourceDir = new URL("../../data/source/", import.meta.url);

function readAll<T>(dir: string, parse: (raw: unknown) => T): T[] {
  const folder = new URL(`${dir}/`, sourceDir);
  return readdirSync(folder)
    .filter((f) => f.endsWith(".json"))
    .map((f) => parse(JSON.parse(readFileSync(new URL(f, folder), "utf-8"))));
}

const stations = readAll("stations", (raw) => StationSchema.parse(raw));
const segments = readAll("segments", (raw) => SegmentSchema.parse(raw));

const stationIdsAt = (date: string) =>
  new Set(filterAsOf(stations, date).map((s) => s.id));
const segmentIdsAt = (date: string) =>
  new Set(filterAsOf(segments, date).map((s) => s.id));

describe("BTS Sukhumvit north extension (N14-N24)", () => {
  it("has no N14 on 2020-01-01 and no N24 until Khu Khot opens", () => {
    expect(stationIdsAt("2020-01-01").has("N14")).toBe(false);
    expect(stationIdsAt("2020-01-01").has("N13")).toBe(true);
    expect(stationIdsAt("2020-12-15").has("N24")).toBe(false);
  });

  it("opens N14-N17 on 2020-06-05 and N18-N24 on 2020-12-16", () => {
    const june = stationIdsAt("2020-06-05");
    for (const id of ["N14", "N15", "N16", "N17"])
      expect(june.has(id)).toBe(true);
    for (const id of ["N18", "N24"]) expect(june.has(id)).toBe(false);

    const dec = stationIdsAt("2020-12-16");
    for (let n = 14; n <= 24; n++) expect(dec.has(`N${n}`)).toBe(true);
  });

  it("has N24 on 2021-01-01", () => {
    expect(stationIdsAt("2021-01-01").has("N24")).toBe(true);
  });
});

describe("BTS Silom Saint Louis infill (S4)", () => {
  it("keeps S3__S5 valid through 2020 and retires it by 2022", () => {
    expect(segmentIdsAt("2020-06-01").has("S3__S5")).toBe(true);
    expect(segmentIdsAt("2021-02-07").has("S3__S5")).toBe(true);
    expect(segmentIdsAt("2022-01-01").has("S3__S5")).toBe(false);
  });

  it("swaps S3__S5 for S3__S4 + S4__S5 on 2021-02-08, not before", () => {
    const before = segmentIdsAt("2020-06-01");
    expect(before.has("S3__S4")).toBe(false);
    expect(before.has("S4__S5")).toBe(false);
    expect(stationIdsAt("2020-06-01").has("S4")).toBe(false);

    const after = segmentIdsAt("2022-01-01");
    expect(after.has("S3__S4")).toBe(true);
    expect(after.has("S4__S5")).toBe(true);
    expect(stationIdsAt("2022-01-01").has("S4")).toBe(true);
  });

  it("never leaves S3 and S5 joined by two competing routes", () => {
    for (const date of ["2021-02-07", "2021-02-08"]) {
      const ids = segmentIdsAt(date);
      const direct = ids.has("S3__S5");
      const viaS4 = ids.has("S3__S4") && ids.has("S4__S5");
      expect(direct !== viaS4).toBe(true);
    }
  });
});

describe("MRT Blue Line Tha Phra and the northern loop", () => {
  // Undirected reachability over the MRT_BLUE segments valid on `date`,
  // optionally ignoring one segment id.
  const reachable = (date: string, from: string, to: string, skip?: string) => {
    const adjacency = new Map<string, string[]>();
    for (const s of filterAsOf(segments, date)) {
      if (s.line !== "MRT_BLUE" || s.id === skip) continue;
      adjacency.set(s.from_station, [
        ...(adjacency.get(s.from_station) ?? []),
        s.to_station,
      ]);
      adjacency.set(s.to_station, [
        ...(adjacency.get(s.to_station) ?? []),
        s.from_station,
      ]);
    }
    const seen = new Set([from]);
    const queue = [from];
    while (queue.length > 0) {
      const next = queue.shift()!;
      if (next === to) return true;
      for (const n of adjacency.get(next) ?? []) {
        if (!seen.has(n)) {
          seen.add(n);
          queue.push(n);
        }
      }
    }
    return false;
  };

  const loopSegmentIds = [
    "BL01__BL02",
    "BL02__BL03",
    "BL03__BL04",
    "BL04__BL05",
    "BL05__BL06",
    "BL06__BL07",
    "BL07__BL08",
    "BL08__BL09",
    "BL09__BL10",
  ];

  it("puts Tha Phra between Itsaraphap and Bang Phai, with no BL32__BL33", () => {
    expect(segments.some((s) => s.id === "BL32__BL33")).toBe(false);
    const ids = segmentIdsAt("2019-12-31");
    expect(ids.has("BL32__BL01")).toBe(true);
    expect(ids.has("BL01__BL33")).toBe(true);
    expect(stationIdsAt("2019-10-01").has("BL01")).toBe(true);
    expect(stationIdsAt("2019-09-28").has("BL01")).toBe(false);
  });

  it("keeps Tha Phra on a single code, BL01", () => {
    const thaPhra = stations.find((s) => s.id === "BL01")!;
    expect(thaPhra.code_history.map((c) => c.code)).toEqual(["BL01"]);
    // Bang Wa keeps BL34 and is untouched by the Tha Phra fix.
    expect(stations.find((s) => s.id === "BL34")!.code_history[0]!.code).toBe(
      "BL34",
    );
  });

  it("has no loop segments before commercial opening on 2020-03-30", () => {
    const ids = segmentIdsAt("2020-03-29");
    for (const id of loopSegmentIds) expect(ids.has(id)).toBe(false);
  });

  it("is a closed loop on 2020-12-31 but not on 2019-12-31", () => {
    const ids = segmentIdsAt("2020-12-31");
    for (const id of loopSegmentIds) expect(ids.has(id)).toBe(true);

    // The loop closes when Tha Phra still reaches Itsaraphap by the long way
    // round after the direct BL32__BL01 link is removed.
    expect(reachable("2020-12-31", "BL01", "BL32", "BL32__BL01")).toBe(true);
    expect(reachable("2019-12-31", "BL01", "BL32", "BL32__BL01")).toBe(false);
  });

  it("dates BL10__BL11 from Tao Poon's 2017 opening, not the 2004 original", () => {
    expect(segmentIdsAt("2016-12-31").has("BL10__BL11")).toBe(false);
    expect(segmentIdsAt("2017-08-11").has("BL10__BL11")).toBe(true);
  });
});

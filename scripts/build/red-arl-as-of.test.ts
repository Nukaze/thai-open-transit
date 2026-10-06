import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { StationSchema, SegmentSchema } from "schema";
import { filterAsOf } from "network-graph";

// Reads the committed source entities (not data/dist, which is generated and
// gitignored) so the test sees exactly what seed-red-arl.ts wrote.
function readDir<T>(dir: string, parse: (raw: unknown) => T): T[] {
  const url = new URL(`../../data/source/${dir}/`, import.meta.url);
  return readdirSync(url)
    .filter((f) => f.endsWith(".json"))
    .map((f) => parse(JSON.parse(readFileSync(new URL(f, url), "utf-8"))));
}

const stations = readDir("stations", (raw) => StationSchema.parse(raw));
const segments = readDir("segments", (raw) => SegmentSchema.parse(raw));

const onLine = (asOf: string, lineIds: string[]) =>
  filterAsOf(stations, asOf).filter((s) =>
    s.validity.some(
      (v) =>
        lineIds.includes(v.line) &&
        v.from <= asOf &&
        (v.to === null || v.to > asOf),
    ),
  );

const RED = ["SRT_DARKRED", "SRT_LIGHTRED"];

describe("SRT Red Lines and Airport Rail Link as_of filtering", () => {
  it("has no Red Line station or segment before the 2021-11-29 opening", () => {
    expect(onLine("2021-06-30", RED)).toEqual([]);
    expect(
      filterAsOf(segments, "2021-06-30").filter((s) => RED.includes(s.line)),
    ).toEqual([]);
  });

  it("has both Red lines sharing one station after opening", () => {
    const asOf = "2021-12-31";
    expect(onLine(asOf, ["SRT_DARKRED"])).toHaveLength(10);
    expect(onLine(asOf, ["SRT_LIGHTRED"])).toHaveLength(4);

    const shared = stations.filter(
      (s) =>
        s.validity.some((v) => v.line === "SRT_DARKRED") &&
        s.validity.some((v) => v.line === "SRT_LIGHTRED"),
    );
    expect(shared.map((s) => s.id)).toEqual(["RN01"]);
    expect(shared[0]!.code_history.map((c) => c.code).sort()).toEqual([
      "RN01",
      "RW01",
    ]);
    // 10 Dark Red + 4 Light Red, minus the shared station counted once.
    expect(onLine(asOf, RED)).toHaveLength(13);
  });

  it("dates the rename of the shared station without changing its id", () => {
    const kta = stations.find((s) => s.id === "RN01")!;
    const rename = kta.milestones.find((m) => m.event === "renamed");
    expect(rename?.date_precision).toBe("month");
    expect(rename?.source_refs.length).toBeGreaterThan(0);
  });

  it("has no Airport Rail Link before its 2010-08-23 opening", () => {
    expect(onLine("2009-12-31", ["ARL_AIRPORT"])).toEqual([]);
    expect(
      filterAsOf(segments, "2009-12-31").filter(
        (s) => s.line === "ARL_AIRPORT",
      ),
    ).toEqual([]);
    expect(onLine("2010-12-31", ["ARL_AIRPORT"])).toHaveLength(8);
  });
});

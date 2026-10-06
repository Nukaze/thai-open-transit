import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { StationSchema } from "schema";
import { resolveInterchangeGroups } from "network-graph";

// Mirrors scripts/build/index.ts: committed source entities with
// data/overrides merged on top, which is where cross-line groups live.
function readDir(dir: string): unknown[] {
  const url = new URL(`../../data/${dir}/`, import.meta.url);
  return readdirSync(url)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(readFileSync(new URL(f, url), "utf-8")) as unknown);
}

const sourceStations = readDir("source/stations").map((raw) =>
  StationSchema.parse(raw),
);
const overrides = readDir("overrides").map(
  (raw) => raw as { id: string } & Record<string, unknown>,
);
const overrideById = new Map(overrides.map((o) => [o.id, o]));
const stations = sourceStations.map((s) =>
  StationSchema.parse({ ...s, ...(overrideById.get(s.id) ?? {}) }),
);
const groups = resolveInterchangeGroups(stations);

const NEW_GROUPS: Record<string, string[]> = {
  KRUNG_THON_BURI: ["G1", "S7"],
  LAT_PHRAO: ["YL01", "BL15"],
  SAMRONG: ["YL23", "E15"],
  NONTHABURI_CIVIC_CENTER: ["PK01", "PP11"],
  WAT_PHRA_SRI_MAHATHAT: ["PK16", "N17"],
  HUA_MAK: ["YL11", "A4"],
  LAK_SI: ["PK14", "RN06"],
  PHAYA_THAI: ["A8", "N2"],
  MAKKASAN_PHETCHABURI: ["A6", "BL21"],
  BANG_SUE: ["RN01", "BL11"],
};

describe("interchange group integrity", () => {
  it("has no override pointing at a station that does not exist", () => {
    const ids = new Set(sourceStations.map((s) => s.id));
    const dangling = overrides.map((o) => o.id).filter((id) => !ids.has(id));
    expect(dangling).toEqual([]);
  });

  it("has no group that links nothing", () => {
    // A single-member group is legitimate only when that one station is itself
    // served by several lines (TAO_POON, SIAM); otherwise it is a typo.
    const linesOf = (id: string) =>
      new Set(
        stations.find((s) => s.id === id)?.validity.map((v) => v.line) ?? [],
      );
    for (const [group, members] of groups) {
      const union = new Set(members.flatMap((m) => [...linesOf(m)]));
      expect(union.size, group).toBeGreaterThan(1);
    }
  });

  it.each(Object.entries(NEW_GROUPS))("resolves %s", (group, members) => {
    expect(groups.get(group)?.slice().sort()).toEqual(members.slice().sort());
  });
});

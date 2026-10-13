// apps/web/lib/stationLabel.test.ts
import { describe, it, expect } from "vitest";
import {
  buildPrefixLineIndex,
  resolveStationLabel,
  pickLabelledStations,
} from "./stationLabel";
import type { StationWithStatus } from "./types";

// Only the fields `stationLabel` reads; shapes mirror the real network.json
// records for these ids (BL10/PP16 Tao Poon, S4->S5 renumbering, CEN Siam).
function station(
  id: string,
  codes: { code: string; from: string; to: string | null }[],
  validity: { line: string; from: string; to: string | null }[],
): StationWithStatus {
  return { id, code_history: codes, validity } as StationWithStatus;
}

const BL10 = station(
  "BL10",
  [
    { code: "PP16", from: "2016-08-06", to: null },
    { code: "BL10", from: "2017-08-11", to: null },
  ],
  [
    { line: "MRT_BLUE", from: "2017-08-11", to: null },
    { line: "MRT_PURPLE", from: "2016-08-06", to: null },
  ],
);
const S5 = station(
  "S5",
  [
    { code: "S4", from: "1999-12-05", to: "2021-02-08" },
    { code: "S5", from: "2021-02-08", to: null },
  ],
  [{ line: "BTS_SILOM", from: "1999-12-05", to: null }],
);
const CEN = station(
  "CEN",
  [{ code: "CEN", from: "1999-12-05", to: null }],
  [
    { line: "BTS_SUKHUMVIT", from: "1999-12-05", to: null },
    { line: "BTS_SILOM", from: "1999-12-05", to: null },
  ],
);
const BL11 = station(
  "BL11",
  [{ code: "BL11", from: "2004-07-03", to: null }],
  [{ line: "MRT_BLUE", from: "2004-07-03", to: null }],
);
const PP15 = station(
  "PP15",
  [{ code: "PP15", from: "2016-08-06", to: null }],
  [{ line: "MRT_PURPLE", from: "2016-08-06", to: null }],
);

const ALL = [BL10, S5, CEN, BL11, PP15];
const prefixLine = buildPrefixLineIndex(ALL);
const colors = new Map([
  ["MRT_BLUE", "#1E3A8A"],
  ["MRT_PURPLE", "#7C3AED"],
  ["BTS_SILOM", "#02817D"],
  ["BTS_SUKHUMVIT", "#65B724"],
]);
const allLines = new Set(colors.keys());

describe("buildPrefixLineIndex", () => {
  it("learns a prefix from single-line stations only", () => {
    expect(prefixLine.get("BL")).toBe("MRT_BLUE");
    expect(prefixLine.get("PP")).toBe("MRT_PURPLE");
    expect(prefixLine.get("S")).toBe("BTS_SILOM");
  });

  it("leaves a prefix seen only on a multi-line station unmapped", () => {
    expect(prefixLine.has("CEN")).toBe(false);
  });
});

describe("resolveStationLabel", () => {
  it("shows the pre-renumbering code before the recode date", () => {
    const label = resolveStationLabel(
      S5,
      "2020-12-31",
      allLines,
      colors,
      prefixLine,
    );
    expect(label.codes).toEqual(["S4"]);
  });

  it("shows the new code after the recode date", () => {
    const label = resolveStationLabel(
      S5,
      "2022-12-31",
      allLines,
      colors,
      prefixLine,
    );
    expect(label.codes).toEqual(["S5"]);
    expect(label.ringColor).toBe("#02817D");
  });

  it("drops retired codes in the unfiltered (null date) view", () => {
    const label = resolveStationLabel(S5, null, allLines, colors, prefixLine);
    expect(label.codes).toEqual(["S5"]);
  });

  it("keeps a closed line's station served in the null-date view", () => {
    // HomeClient draws a station on a null date if ANY window is on an
    // active line, closed or not; the label must agree, not fall back to
    // the neutral interchange ring and top collision priority.
    const closed = station(
      "X1",
      [{ code: "X1", from: "2000-01-01", to: "2010-01-01" }],
      [{ line: "BTS_SILOM", from: "2000-01-01", to: "2010-01-01" }],
    );
    const label = resolveStationLabel(
      closed,
      null,
      allLines,
      colors,
      prefixLine,
    );
    expect(label.codes).toEqual(["X1"]);
    expect(label.ringColor).toBe("#02817D");
    expect(label.interchange).toBe(false);
    expect(label.openedFrom).toBe("2000-01-01");
  });

  it("does not mark a single-line station with no known color as an interchange", () => {
    const label = resolveStationLabel(
      S5,
      "2022-12-31",
      allLines,
      new Map(),
      prefixLine,
    );
    expect(label.ringColor).toBeNull();
    expect(label.interchange).toBe(false);
  });

  it("shows only the code of the line open on the date", () => {
    const label = resolveStationLabel(
      BL10,
      "2016-12-31",
      allLines,
      colors,
      prefixLine,
    );
    expect(label.codes).toEqual(["PP16"]);
    expect(label.ringColor).toBe("#7C3AED");
    expect(label.openedFrom).toBe("2016-08-06");
  });

  it("stacks both codes with a neutral ring once both lines serve it", () => {
    const label = resolveStationLabel(
      BL10,
      "2024-12-31",
      allLines,
      colors,
      prefixLine,
    );
    expect(label.codes).toEqual(["PP16", "BL10"]);
    expect(label.ringColor).toBeNull();
    expect(label.interchange).toBe(true);
  });

  it("hides a filtered-off line's code and takes the remaining line's color", () => {
    const label = resolveStationLabel(
      BL10,
      "2024-12-31",
      new Set(["MRT_PURPLE"]),
      colors,
      prefixLine,
    );
    expect(label.codes).toEqual(["PP16"]);
    expect(label.ringColor).toBe("#7C3AED");
  });

  it("keeps an unmapped shared code whichever line is visible", () => {
    const label = resolveStationLabel(
      CEN,
      "2024-12-31",
      new Set(["BTS_SILOM"]),
      colors,
      prefixLine,
    );
    expect(label.codes).toEqual(["CEN"]);
    expect(label.ringColor).toBe("#02817D");
  });

  it("reports no opening date for a station not visible on the date", () => {
    const label = resolveStationLabel(
      BL11,
      "2000-12-31",
      allLines,
      colors,
      prefixLine,
    );
    expect(label.openedFrom).toBeNull();
  });
});

describe("pickLabelledStations", () => {
  const latPhrao = { interchange_group: "LAT_PHRAO", name_th: "ลาดพร้าว" };

  it("labels one member of a same-name group, the earliest opened", () => {
    const labelled = pickLabelledStations([
      { id: "YL01", ...latPhrao, openedFrom: "2023-07-03" },
      { id: "BL15", ...latPhrao, openedFrom: "2004-07-03" },
    ]);
    expect([...labelled]).toEqual(["BL15"]);
  });

  it("falls back to the member that is visible on the date", () => {
    const labelled = pickLabelledStations([
      { id: "YL01", ...latPhrao, openedFrom: "2023-07-03" },
    ]);
    expect([...labelled]).toEqual(["YL01"]);
  });

  it("breaks an opening-date tie by id", () => {
    const labelled = pickLabelledStations([
      { id: "RW01", ...latPhrao, openedFrom: "2021-11-29" },
      { id: "RN01", ...latPhrao, openedFrom: "2021-11-29" },
    ]);
    expect([...labelled]).toEqual(["RN01"]);
  });

  it("labels every member of a group whose names differ", () => {
    const labelled = pickLabelledStations([
      {
        id: "N8",
        interchange_group: "MOCHIT",
        name_th: "หมอชิต",
        openedFrom: "1999-12-05",
      },
      {
        id: "BL13",
        interchange_group: "MOCHIT",
        name_th: "สวนจตุจักร",
        openedFrom: "2004-07-03",
      },
    ]);
    expect(labelled).toEqual(new Set(["N8", "BL13"]));
  });

  it("labels stations outside any interchange group", () => {
    const labelled = pickLabelledStations([
      { id: "N3", interchange_group: null, name_th: "x", openedFrom: "1999" },
    ]);
    expect(labelled).toEqual(new Set(["N3"]));
  });
});

// apps/web/lib/lineGroups.ts
import type { Line } from "schema";

// How the line filter groups its chips: by the system riders know a line
// by (the brand on the logo), not by operator company - MRT Blue, Pink,
// Purple and Yellow are four operators but one "MRT". Presentation only,
// keyed by ID prefix (CLAUDE.md 5: `{OPERATOR}_{COLOR}`).
export type LineGroupId = "bts" | "mrt" | "srt";

const GROUP_BY_PREFIX: Record<string, LineGroupId> = {
  BTS: "bts",
  MRT: "mrt",
  SRT: "srt",
  // Airport Rail Link is run by SRT Electrified Train, like the Red Lines.
  ARL: "srt",
};

export const LINE_GROUP_ORDER: LineGroupId[] = ["bts", "mrt", "srt"];

export function lineGroup(line: Line): LineGroupId | null {
  return GROUP_BY_PREFIX[line.id.split("_")[0] ?? ""] ?? null;
}

// "BTS Sukhumvit Line" -> "Sukhumvit": inside a group labelled BTS, the
// brand and the word "Line" repeat on every chip. Names that don't follow
// the pattern ("Airport Rail Link") are kept whole.
export function lineShortName(line: Line): string {
  const short = line.name_en
    .replace(/^(BTS|MRT|SRT)\s+/, "")
    .replace(/\s+Line$/, "");
  return short || line.name_en;
}

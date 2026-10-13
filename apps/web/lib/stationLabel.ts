// apps/web/lib/stationLabel.ts
import type { Line } from "schema";
import type { StationWithStatus } from "./types";
import { isValidAt } from "./asOf";

// `selectedDate === null` is HomeClient's "unfiltered by date" state (before
// the mount effect resolves the visitor's year). Treated as "open-ended
// windows only", i.e. the network as it stands today, so a code that was
// retired (S4 -> S5) never shows in the unfiltered view.
function windowActive(
  window: { from: string; to: string | null },
  date: string | null,
): boolean {
  return date === null ? window.to === null : isValidAt(window, date);
}

function codePrefix(code: string): string {
  return code.match(/^[A-Z]+/)?.[0] ?? code;
}

// `code_history` entries carry no `line`, and `Line` has no code-prefix
// field, yet a two-line station holds one code per line (BL10 is also PP16,
// RN01 is also RW01) and only the codes of currently visible lines should
// show. The prefix -> line mapping is therefore learned from the data
// itself: a station that only ever served ONE line says unambiguously which
// line its prefix belongs to. A prefix seen on two different single-line
// stations of different lines, or only on multi-line stations (CEN), stays
// unmapped and is shown whenever the station is visible at all.
export function buildPrefixLineIndex(
  stations: StationWithStatus[],
): Map<string, string> {
  const candidates = new Map<string, Set<string>>();
  for (const station of stations) {
    const stationLines = new Set(station.validity.map((v) => v.line));
    if (stationLines.size !== 1) continue;
    const [line] = stationLines;
    for (const entry of station.code_history) {
      const prefix = codePrefix(entry.code);
      if (!candidates.has(prefix)) candidates.set(prefix, new Set());
      candidates.get(prefix)!.add(line!);
    }
  }
  const index = new Map<string, string>();
  for (const [prefix, lineIds] of candidates) {
    if (lineIds.size === 1) index.set(prefix, [...lineIds][0]!);
  }
  return index;
}

export interface StationLabel {
  // Every code valid on the date for a line that is both served and shown,
  // in `code_history` order. Usually one; two at a cross-line station that
  // carries a code per line.
  codes: string[];
  // The ring color: the line's own color when exactly one visible line
  // serves the station, `null` for a multi-line station so the map can draw
  // its neutral interchange ring instead of picking one line arbitrarily.
  ringColor: string | null;
  // Earliest `from` among the windows that make the station visible - the
  // tie-breaker `pickLabelledStations` uses. `null` when not visible.
  openedFrom: string | null;
}

export function resolveStationLabel(
  station: StationWithStatus,
  date: string | null,
  activeLineIds: ReadonlySet<string>,
  lineColorById: ReadonlyMap<string, string>,
  prefixLine: ReadonlyMap<string, string>,
): StationLabel {
  const visibleWindows = station.validity.filter(
    (v) => activeLineIds.has(v.line) && windowActive(v, date),
  );
  const visibleLines = new Set(visibleWindows.map((v) => v.line));

  const codes = station.code_history
    .filter((entry) => windowActive(entry, date))
    .filter((entry) => {
      const line = prefixLine.get(codePrefix(entry.code));
      return line === undefined || visibleLines.has(line);
    })
    .map((entry) => entry.code);

  const ringColor =
    visibleLines.size === 1
      ? (lineColorById.get([...visibleLines][0]!) ?? null)
      : null;

  const openedFrom =
    visibleWindows.length === 0
      ? null
      : visibleWindows.map((v) => v.from).sort()[0]!;

  return { codes, ringColor, openedFrom };
}

export function lineColorIndex(lines: Line[]): Map<string, string> {
  return new Map(lines.map((l) => [l.id, l.color_hex]));
}

// Interchange members that share a name (BL15 and YL01 are both
// "ลาดพร้าว / Lat Phrao") sit metres apart, so labelling each one prints the
// same name twice side by side. One member per (group, name) carries the
// label: the earliest-opened among those VISIBLE on the date, ties broken by
// id. Picking among visible members only is the point - picking once, up
// front, would leave Lat Phrao unlabelled in 2010, when only BL15 existed.
// Members of a group with different names (Mo Chit / Chatuchak Park) are
// different labels and all print.
export function pickLabelledStations(
  visible: {
    id: string;
    name_th: string;
    interchange_group?: string | null;
    openedFrom: string;
  }[],
): Set<string> {
  const winners = new Map<string, { id: string; openedFrom: string }>();
  const labelled = new Set<string>();
  for (const station of visible) {
    if (!station.interchange_group) {
      labelled.add(station.id);
      continue;
    }
    const key = `${station.interchange_group}|${station.name_th}`;
    const current = winners.get(key);
    if (
      !current ||
      station.openedFrom < current.openedFrom ||
      (station.openedFrom === current.openedFrom && station.id < current.id)
    ) {
      winners.set(key, station);
    }
  }
  for (const { id } of winners.values()) labelled.add(id);
  return labelled;
}

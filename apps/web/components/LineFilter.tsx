// apps/web/components/LineFilter.tsx
"use client";

import type { Line } from "schema";
import { t } from "../lib/i18n";
import {
  LINE_GROUP_ORDER,
  lineGroup,
  lineShortName,
  type LineGroupId,
} from "../lib/lineGroups";
import { LineLogo } from "./LineLogo";
import { EyeIcon, EyeOffIcon, InfoIcon } from "./icons";

// Desktop: chips grouped by system (BTS / MRT / SRT) with short names under
// a small group label. Phones: the groups dissolve (`display: contents`)
// into one horizontal chip row with full names, which is what the collapsed
// sheet's fixed height is sized for. Each chip is a toggle; `aria-pressed`
// carries the state and the full line name is always its accessible name.
// Each desktop group label also carries a Show / Hide link for the whole
// group, flipping by the same rule as the section's Show all / Hide all, so
// "Hide all, then show MRT" is two clicks and groups add up.
export function LineFilter({
  lines,
  activeLineIds,
  onToggle,
  onShowAll,
  onHideAll,
  onSetLines,
}: {
  lines: Line[];
  activeLineIds: Set<string>;
  onToggle: (id: string) => void;
  onShowAll: () => void;
  onHideAll: () => void;
  onSetLines: (ids: string[], visible: boolean) => void;
}) {
  const shownCount = lines.filter((l) => activeLineIds.has(l.id)).length;
  const allOn = shownCount === lines.length;

  // Grouped in a fixed order; a line with an unknown prefix lands in a
  // trailing unlabeled group rather than disappearing.
  const groups = new Map<LineGroupId | null, Line[]>();
  for (const id of [...LINE_GROUP_ORDER, null]) groups.set(id, []);
  for (const line of lines) groups.get(lineGroup(line))!.push(line);
  // Within SRT, the two short Red Line chips share the first row and the
  // long "Airport Rail Link" wraps alone, instead of splitting the pair.
  groups
    .get("srt")!
    .sort(
      (a, b) => Number(a.id.startsWith("ARL")) - Number(b.id.startsWith("ARL")),
    );

  return (
    <section className="section">
      <div className="section-head">
        <h2 className="section-title">{t("lines", "en")}</h2>
        <span className="section-head-aside" aria-live="polite">
          {t("lines_shown", "en")
            .replace("{shown}", String(shownCount))
            .replace("{total}", String(lines.length))}
          {/* One button whose label is its action, as a "select all" does:
              Hide all only when every line is on; from any partial state it
              offers the way back to the full map. Both labels are about the
              same width, so nothing shifts when it flips. */}
          <button
            type="button"
            className="link-btn"
            onClick={allOn ? onHideAll : onShowAll}
          >
            {allOn ? <EyeOffIcon /> : <EyeIcon />}
            {t(allOn ? "hide_all" : "show_all", "en")}
          </button>
        </span>
      </div>
      <p className="section-hint">
        <InfoIcon />
        <span>{t("lines_hint", "en")}</span>
      </p>
      <div className="line-groups">
        {[...groups].map(([groupId, groupLines]) =>
          groupLines.length === 0 ? null : (
            <div
              key={groupId ?? "other"}
              className="line-group"
              role="group"
              aria-label={groupId ? t(`group_${groupId}`, "en") : undefined}
            >
              {groupId && (
                <GroupHead
                  name={t(`group_${groupId}`, "en")}
                  allOn={groupLines.every((l) => activeLineIds.has(l.id))}
                  onSet={(visible) =>
                    onSetLines(
                      groupLines.map((l) => l.id),
                      visible,
                    )
                  }
                />
              )}
              <div className="chips">
                {groupLines.map((line) => (
                  <button
                    key={line.id}
                    type="button"
                    className="chip"
                    aria-pressed={activeLineIds.has(line.id)}
                    aria-label={line.name_en}
                    title={line.name_en}
                    onClick={() => onToggle(line.id)}
                  >
                    <LineLogo line={line} />
                    <span className="chip-name-full">{line.name_en}</span>
                    <span className="chip-name-short">
                      {lineShortName(line)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ),
        )}
      </div>
    </section>
  );
}

// Desktop only: on phones the groups dissolve into one chip row with no
// labels (CSS hides the head), so there is nowhere to put the link.
function GroupHead({
  name,
  allOn,
  onSet,
}: {
  name: string;
  allOn: boolean;
  onSet: (visible: boolean) => void;
}) {
  const label = t(allOn ? "hide_group" : "show_group", "en").replace(
    "{group}",
    name,
  );
  return (
    <div className="line-group-head">
      <span className="line-group-label" aria-hidden="true">
        {name}
      </span>
      {/* Visible text is one word; the accessible name says which group,
          since a screen reader hears three of these in a row. */}
      <button
        type="button"
        className="link-btn line-group-toggle"
        aria-label={label}
        title={label}
        onClick={() => onSet(!allOn)}
      >
        {allOn ? <EyeOffIcon size={13} /> : <EyeIcon size={13} />}
        {t(allOn ? "hide" : "show", "en")}
      </button>
    </div>
  );
}

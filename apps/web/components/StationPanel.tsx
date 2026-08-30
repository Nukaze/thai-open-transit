// apps/web/components/StationPanel.tsx
"use client";

import { StatusBadge } from "ui";
import type { Line } from "schema";
import type { StationWithStatus } from "../lib/types";
import { ReportErrorButton } from "./ReportErrorButton";

export function StationPanel({
  station,
  lines,
  onClose,
}: {
  station: StationWithStatus | null;
  lines: Line[];
  onClose: () => void;
}) {
  if (!station) return null;

  // Lines served come from `validity[]` rather than from the segments graph:
  // validity is the station's own record of which line it belongs to and when,
  // so it stays correct for a station that is planned or closed and therefore
  // has no operational segments attached. Ids are resolved to Line records for
  // display; an id with no matching Line is dropped rather than rendered raw,
  // since a bare id is not useful to a reader.
  const linesById = new Map(lines.map((l) => [l.id, l]));
  const servingLines = [...new Set(station.validity.map((v) => v.line))]
    .map((id) => linesById.get(id))
    .filter((line): line is Line => line !== undefined);

  // A station can carry several milestones; `opened` is the one users ask
  // about. Planned and under-construction stations have no `opened` milestone
  // at all, which is a meaningful answer rather than missing data.
  const openedMilestone = station.milestones.find((m) => m.event === "opened");
  return (
    <aside
      style={{
        position: "absolute",
        top: 0,
        right: 0,
        width: 320,
        height: "100%",
        background: "white",
        padding: 16,
      }}
    >
      <button onClick={onClose}>Close</button>
      <h2>{station.name_en ?? station.name_th}</h2>
      <p lang="th">{station.name_th}</p>
      <StatusBadge status={station.status} />
      <p>Structure: {station.structure}</p>
      <p>Accessible: {station.accessible ? "Yes" : "No"}</p>
      <div>
        Lines:{" "}
        {servingLines.length === 0 ? (
          "Unknown"
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: "4px 0" }}>
            {servingLines.map((line) => (
              <li key={line.id}>
                <span
                  aria-hidden="true"
                  style={{
                    display: "inline-block",
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: line.color_hex,
                    marginRight: 6,
                  }}
                />
                {line.name_en} <span lang="th">({line.name_th})</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <p>Opened: {openedMilestone ? openedMilestone.date : "Not yet opened"}</p>
      <p>Last verified: {station.last_verified_at}</p>
      <ReportErrorButton station={station} />
    </aside>
  );
}

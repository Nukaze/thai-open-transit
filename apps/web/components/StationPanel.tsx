// apps/web/components/StationPanel.tsx
"use client";

import { useState } from "react";
import type { Line, Status } from "schema";
import type { StationWithStatus } from "../lib/types";
import { t } from "../lib/i18n";
import { ReportErrorButton } from "./ReportErrorButton";
import { LineLogo } from "./LineLogo";
import { CloseIcon, LinkIcon } from "./icons";

// Same copy as `ui`'s StatusBadge; rendered locally so the badge can carry
// this app's pill styling via `data-status`.
const STATUS_LABEL: Record<Status, string> = {
  operational: "Operational",
  trial: "Trial service",
  under_construction: "Under construction",
  approved: "Approved",
  planned: "Planned",
  proposed: "Proposed",
  suspended: "Suspended",
  cancelled: "Cancelled",
};

const STRUCTURE_LABEL: Record<string, string> = {
  elevated: "Elevated",
  underground: "Underground",
  at_grade: "At grade",
};

export function StationPanel({
  station,
  lines,
  onClose,
}: {
  station: StationWithStatus;
  lines: Line[];
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

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

  const copyLink = async () => {
    // The URL already carries `?station=` (HomeClient writes it on select).
    const url = window.location.href;
    try {
      if (navigator.share && matchMedia("(pointer: coarse)").matches) {
        await navigator.share({
          title: station.name_en ?? station.name_th,
          url,
        });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Share sheet dismissed or clipboard blocked: nothing to report.
    }
  };

  const details: [string, string][] = [
    [
      t("structure", "en"),
      STRUCTURE_LABEL[station.structure] ?? station.structure,
    ],
    [t("accessible", "en"), station.accessible ? "Yes" : "No"],
    [
      t("opened", "en"),
      openedMilestone ? openedMilestone.date : t("not_yet_opened", "en"),
    ],
    [t("last_verified", "en"), station.last_verified_at],
  ];

  return (
    <article
      className="fade-in"
      key={station.id}
      aria-labelledby="station-title"
    >
      <div className="station-head">
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 id="station-title" className="station-title">
            {station.name_en ?? station.name_th}
          </h2>
          <p className="station-th" lang="th">
            {station.name_th}
          </p>
          <span className="status" data-status={station.status}>
            {STATUS_LABEL[station.status]}
          </span>
        </div>
        <button
          type="button"
          className="icon-btn"
          aria-label="Close"
          onClick={onClose}
        >
          <CloseIcon />
        </button>
      </div>

      <section className="section">
        <h3 className="section-title">{t("lines", "en")}</h3>
        {servingLines.length === 0 ? (
          <p className="empty">Unknown</p>
        ) : (
          <ul className="list">
            {servingLines.map((line) => (
              <li key={line.id}>
                <div className="row">
                  <span
                    className="line-bar"
                    aria-hidden="true"
                    style={{ background: line.color_hex }}
                  />
                  <LineLogo line={line} size={28} />
                  <span className="row-main">
                    <span className="row-title" style={{ display: "block" }}>
                      {line.name_en}
                    </span>
                    <span
                      className="row-sub"
                      lang="th"
                      style={{ display: "block" }}
                    >
                      {line.name_th}
                    </span>
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="section">
        <h3 className="section-title">{t("details", "en")}</h3>
        <dl className="list" style={{ margin: 0 }}>
          {details.map(([label, value]) => (
            <div className="row" key={label}>
              <dt className="row-main" style={{ color: "var(--ink-2)" }}>
                {label}
              </dt>
              <dd className="row-value" style={{ margin: 0 }}>
                {value}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="actions">
        <button type="button" className="btn btn-primary" onClick={copyLink}>
          <LinkIcon />
          {copied ? t("copied", "en") : t("share", "en")}
        </button>
        <ReportErrorButton station={station} />
      </div>
    </article>
  );
}

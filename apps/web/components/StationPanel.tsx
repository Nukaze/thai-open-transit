// apps/web/components/StationPanel.tsx
"use client";

import { useState } from "react";
import type { Line } from "schema";
import type { StationWithStatus } from "../lib/types";
import { names, useLang } from "../lib/lang";
import { t, type Lang } from "../lib/i18n";
import { ReportErrorButton } from "./ReportErrorButton";
import { LineLogo } from "./LineLogo";
import { CloseIcon, LinkIcon } from "./icons";

// Status and structure copy lives in the i18n dictionary as
// `status_<status>` / `structure_<structure>`; the badge carries this app's
// pill styling via `data-status`. An unknown structure value shows raw.
const structureLabel = (structure: string, lang: Lang) => {
  const label = t(`structure_${structure}`, lang);
  return label === `structure_${structure}` ? structure : label;
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
  const lang = useLang();
  const [copied, setCopied] = useState(false);
  // Current language's name as the title, the other under it.
  const stationNames = names(station, lang);

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
          title: stationNames.primary,
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
    [t("structure", lang), structureLabel(station.structure, lang)],
    [t("accessible", lang), t(station.accessible ? "yes" : "no", lang)],
    [
      t("opened", lang),
      openedMilestone ? openedMilestone.date : t("not_yet_opened", lang),
    ],
    [t("last_verified", lang), station.last_verified_at],
  ];

  return (
    <article
      className="fade-in"
      key={station.id}
      aria-labelledby="station-title"
    >
      <div className="station-head">
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2
            id="station-title"
            className="station-title"
            lang={stationNames.primaryLang}
          >
            {stationNames.primary}
          </h2>
          {stationNames.secondary && (
            <p className="station-th" lang={stationNames.secondaryLang}>
              {stationNames.secondary}
            </p>
          )}
          <span className="status" data-status={station.status}>
            {t(`status_${station.status}`, lang)}
          </span>
        </div>
        <button
          type="button"
          className="icon-btn"
          aria-label={t("close", lang)}
          onClick={onClose}
        >
          <CloseIcon />
        </button>
      </div>

      <section className="section">
        <h3 className="section-title">{t("lines", lang)}</h3>
        {servingLines.length === 0 ? (
          <p className="empty">{t("unknown", lang)}</p>
        ) : (
          <ul className="list">
            {servingLines.map((line) => {
              const lineNames = names(line, lang);
              return (
                <li key={line.id}>
                  <div className="row">
                    <span
                      className="line-bar"
                      aria-hidden="true"
                      style={{ background: line.color_hex }}
                    />
                    <LineLogo line={line} size={28} />
                    <span className="row-main">
                      <span
                        className="row-title"
                        lang={lineNames.primaryLang}
                        style={{ display: "block" }}
                      >
                        {lineNames.primary}
                      </span>
                      {lineNames.secondary && (
                        <span
                          className="row-sub"
                          lang={lineNames.secondaryLang}
                          style={{ display: "block" }}
                        >
                          {lineNames.secondary}
                        </span>
                      )}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="section">
        <h3 className="section-title">{t("details", lang)}</h3>
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
          {copied ? t("copied", lang) : t("share", lang)}
        </button>
        <ReportErrorButton station={station} />
      </div>
    </article>
  );
}

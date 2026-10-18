// apps/web/components/YearSelector.tsx
"use client";

import { useEffect, useState } from "react";
import { t } from "../lib/i18n";
import { ResetViewIcon } from "./icons";

// While a finger or mouse holds the year slider, `data-scrubbing` on <html>
// fades everything but this card (globals.css), so the map shows through
// and the network can be watched changing year by year - the way iOS
// Control Center clears the screen while you drag brightness. Pointer
// only: arrow keys step the year without hiding the panel.

export function YearSelector({
  year,
  minYear,
  maxYear,
  onChange,
}: {
  year: number;
  minYear: number;
  maxYear: number;
  onChange: (year: number) => void;
}) {
  const pct =
    maxYear === minYear ? 100 : ((year - minYear) / (maxYear - minYear)) * 100;
  const isToday = year === maxYear;
  const [scrubbing, setScrubbing] = useState(false);

  useEffect(() => {
    if (!scrubbing) return;
    const root = document.documentElement;
    root.setAttribute("data-scrubbing", "");
    // On window, not the input: the drag often ends off the slider.
    const end = () => setScrubbing(false);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    return () => {
      root.removeAttribute("data-scrubbing");
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
    };
  }, [scrubbing]);

  return (
    <section className="section time-travel">
      <h2 className="section-title">{t("time_travel", "en")}</h2>
      <div className="year-card">
        <div className="year-head">
          <div className="year-value" aria-live="polite">
            {year}
            <small>
              {isToday ? t("today", "en") : t("network_as_of", "en")}
            </small>
          </div>
          {/* Only away from the present, so the card at its usual state
              stays as it is: one tap back to today. */}
          {!isToday && (
            <button
              type="button"
              className="link-btn year-today"
              aria-label={t("back_to_today", "en")}
              title={t("back_to_today", "en")}
              onClick={() => onChange(maxYear)}
            >
              <ResetViewIcon size={14} />
              {t("today", "en")}
            </button>
          )}
        </div>
        <input
          className="range"
          type="range"
          aria-label={t("time_travel", "en")}
          min={minYear}
          max={maxYear}
          step={1}
          value={year}
          style={{ ["--pct" as string]: `${pct}%` }}
          onChange={(e) => onChange(Number(e.target.value))}
          onPointerDown={() => setScrubbing(true)}
        />
        <div className="range-ends" aria-hidden="true">
          <span>{minYear}</span>
          <span>{maxYear}</span>
        </div>
      </div>
    </section>
  );
}

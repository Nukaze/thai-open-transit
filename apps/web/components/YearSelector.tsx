// apps/web/components/YearSelector.tsx
"use client";

import { t } from "../lib/i18n";

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
  return (
    <section className="section">
      <h2 className="section-title">{t("time_travel", "en")}</h2>
      <div className="year-card">
        <div className="year-value" aria-live="polite">
          {year}
          <small>{isToday ? t("today", "en") : t("network_as_of", "en")}</small>
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
        />
        <div className="range-ends" aria-hidden="true">
          <span>{minYear}</span>
          <span>{maxYear}</span>
        </div>
      </div>
    </section>
  );
}

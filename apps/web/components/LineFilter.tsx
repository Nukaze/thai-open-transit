// apps/web/components/LineFilter.tsx
"use client";

import type { Line } from "schema";
import { t } from "../lib/i18n";

// Horizontal chip row on phones (stays inside the collapsed sheet), wrapping
// grid on desktop. Each chip is a toggle; `aria-pressed` carries the state.
export function LineFilter({
  lines,
  activeLineIds,
  onToggle,
  onShowAll,
}: {
  lines: Line[];
  activeLineIds: Set<string>;
  onToggle: (id: string) => void;
  onShowAll: () => void;
}) {
  const allOn = lines.every((l) => activeLineIds.has(l.id));
  return (
    <section className="section">
      <div className="section-head">
        <h2 className="section-title">{t("lines", "en")}</h2>
        {!allOn && (
          <button type="button" className="link-btn" onClick={onShowAll}>
            {t("show_all", "en")}
          </button>
        )}
      </div>
      <div className="chips">
        {lines.map((line) => (
          <button
            key={line.id}
            type="button"
            className="chip"
            aria-pressed={activeLineIds.has(line.id)}
            onClick={() => onToggle(line.id)}
          >
            <span className="dot" style={{ background: line.color_hex }} />
            {line.name_en}
          </button>
        ))}
      </div>
    </section>
  );
}

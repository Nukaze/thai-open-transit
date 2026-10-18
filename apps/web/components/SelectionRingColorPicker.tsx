// apps/web/components/SelectionRingColorPicker.tsx
"use client";

import type { MapTheme } from "./Map";
import { useLang } from "../lib/lang";
import { t } from "../lib/i18n";

export function SelectionRingColorPicker({
  theme,
  color,
  onChange,
}: {
  theme: MapTheme;
  color: string;
  onChange: (color: string) => void;
}) {
  const lang = useLang();
  return (
    // Stored and edited per theme (HomeClient keeps one color per MapTheme);
    // the sub-label says which one this swatch is currently editing, since
    // switching the theme swaps the value underneath it.
    <label className="row" style={{ cursor: "pointer" }}>
      <span className="row-main">
        <span className="row-title" style={{ display: "block" }}>
          {t("ring_color", lang)}
        </span>
        <span className="row-sub" style={{ display: "block" }}>
          {t(theme === "dark" ? "for_dark_map" : "for_light_map", lang)}
        </span>
      </span>
      <span className="swatch" style={{ background: color }}>
        <input
          type="color"
          value={color}
          onChange={(e) => onChange(e.target.value)}
        />
      </span>
    </label>
  );
}

// apps/web/components/ThemeToggle.tsx
"use client";

import type { MapTheme } from "./Map";
import { t } from "../lib/i18n";

export function ThemeToggle({
  theme,
  onChange,
}: {
  theme: MapTheme;
  onChange: (theme: MapTheme) => void;
}) {
  const next: MapTheme = theme === "light" ? "dark" : "light";
  const dark = theme === "dark";

  return (
    <button
      type="button"
      onClick={() => onChange(next)}
      // `aria-pressed` rather than a label that flips between "Light"/"Dark":
      // a toggle whose label changes on activation is read out inconsistently
      // by screen readers, since the name no longer describes the control.
      aria-pressed={dark}
      aria-label={t(dark ? "theme_to_light" : "theme_to_dark", "en")}
      style={{
        // Bottom-left, clearing MapLibre's own logo control: `LineFilter`
        // holds top-left, `StationSearch` holds top-right (and its results
        // list grows downward over anything placed under it), and the
        // attribution control sits bottom-right.
        position: "absolute",
        bottom: 64,
        left: 16,
        padding: "6px 12px",
        border: `1px solid ${dark ? "#4b5563" : "#d1d5db"}`,
        borderRadius: 6,
        background: dark ? "#1f2937" : "white",
        color: dark ? "#f9fafb" : "#111827",
        cursor: "pointer",
      }}
    >
      {t(dark ? "theme_to_light" : "theme_to_dark", "en")}
    </button>
  );
}

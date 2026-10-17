// apps/web/components/StationLabelsToggle.tsx
"use client";

import type { MapTheme } from "./Map";
import { t } from "../lib/i18n";

export function StationLabelsToggle({
  theme,
  on,
  onChange,
}: {
  theme: MapTheme;
  on: boolean;
  onChange: (on: boolean) => void;
}) {
  const dark = theme === "dark";

  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      // A real on/off toggle, unlike ThemeToggle's action button: the label
      // stays fixed ("Station labels") and `aria-pressed` carries the state,
      // so the two never contradict each other.
      aria-pressed={on}
      style={{
        // Stacked above SelectionRingColorPicker (`bottom: 104`), which is
        // itself stacked above ThemeToggle (`bottom: 64`), for the same
        // reason: the bottom-left column grows upward with fixed 40px steps.
        position: "absolute",
        bottom: 144,
        left: 16,
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 12px",
        border: `1px solid ${dark ? "#4b5563" : "#d1d5db"}`,
        borderRadius: 6,
        background: dark ? "#1f2937" : "white",
        color: dark ? "#f9fafb" : "#111827",
        cursor: "pointer",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 28,
          height: 16,
          borderRadius: 8,
          position: "relative",
          background: on ? "#2563eb" : dark ? "#4b5563" : "#d1d5db",
          transition: "background 120ms",
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 2,
            left: on ? 14 : 2,
            width: 12,
            height: 12,
            borderRadius: 6,
            background: "white",
            transition: "left 120ms",
          }}
        />
      </span>
      {t("station_labels", "en")}
    </button>
  );
}

// apps/web/components/SelectionRingColorPicker.tsx
"use client";

import type { MapTheme } from "./Map";

export function SelectionRingColorPicker({
  theme,
  color,
  onChange,
}: {
  theme: MapTheme;
  color: string;
  onChange: (color: string) => void;
}) {
  const dark = theme === "dark";

  return (
    <label
      // Stored and edited per theme (HomeClient keeps one color per
      // MapTheme) - the title says which one this swatch is currently
      // editing, since switching the theme swaps the value underneath it.
      title={`Selection ring color (${theme} map)`}
      style={{
        // Stacked above ThemeToggle (bottom-left, `bottom: 64`) rather than
        // beside it - ThemeToggle's width changes with its label text
        // ("Dark map" vs "Light map"), so stacking avoids guessing a
        // horizontal offset that would overlap it at one width or the other.
        position: "absolute",
        bottom: 104,
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
      <input
        type="color"
        value={color}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: 20,
          height: 20,
          padding: 0,
          border: "none",
          background: "none",
          cursor: "pointer",
        }}
      />
      Ring color ({theme})
    </label>
  );
}

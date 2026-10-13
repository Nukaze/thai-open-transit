// apps/web/components/ThemeToggle.tsx
"use client";

import type { MapTheme } from "./Map";
import { t } from "../lib/i18n";
import { MoonIcon, SunIcon } from "./icons";

// Floating round button over the map (top-right, above the locate button).
// An action button, not a toggle: the label names what activating it does
// ("Dark map" while the map is light), so no `aria-pressed` - a flipping
// label and a pressed state cannot both be right.
export function ThemeToggle({
  theme,
  onChange,
}: {
  theme: MapTheme;
  onChange: (theme: MapTheme) => void;
}) {
  const dark = theme === "dark";
  const label = t(dark ? "theme_to_light" : "theme_to_dark", "en");
  return (
    <button
      type="button"
      className="fab"
      aria-label={label}
      title={label}
      onClick={() => onChange(dark ? "light" : "dark")}
    >
      {dark ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}

// The same choice as a segmented control, for the settings list in the sheet.
export function ThemeSegmented({
  theme,
  onChange,
}: {
  theme: MapTheme;
  onChange: (theme: MapTheme) => void;
}) {
  return (
    <div className="row">
      <span className="row-main row-title">{t("appearance", "en")}</span>
      <div
        className="segmented"
        role="group"
        aria-label={t("appearance", "en")}
      >
        {(["light", "dark"] as const).map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={theme === value}
            onClick={() => onChange(value)}
          >
            {t(value === "light" ? "light" : "dark", "en")}
          </button>
        ))}
      </div>
    </div>
  );
}

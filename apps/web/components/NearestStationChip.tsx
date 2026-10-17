// apps/web/components/NearestStationChip.tsx
"use client";

import type { MapTheme } from "./Map";
import type { StationWithStatus } from "../lib/types";
import { t } from "../lib/i18n";

// GeolocationPositionError codes (W3C Geolocation API). Mapped to copy here
// rather than in Map.tsx so the map stays free of user-facing strings.
const ERROR_KEYS: Record<number, string> = {
  1: "geolocate_denied",
  2: "geolocate_unavailable",
  3: "geolocate_timeout",
};

// Rounded to 10 m below 1 km: consumer GPS accuracy in a dense city is rarely
// better than that, so a value like "347 m" would claim precision it lacks.
export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.max(10, Math.round(meters / 10) * 10)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

export function NearestStationChip({
  theme,
  nearest,
  errorCode,
  onSelect,
}: {
  theme: MapTheme;
  nearest: { station: StationWithStatus; distanceMeters: number } | null;
  errorCode: number | null;
  onSelect: (station: StationWithStatus) => void;
}) {
  if (!nearest && errorCode === null) return null;
  const dark = theme === "dark";

  const style = {
    // Bottom-center, above the whole bottom-left stack (`ThemeToggle` at 64,
    // `SelectionRingColorPicker` at 104, `StationLabelsToggle` at 144, whose
    // top edge is at 174): at bottom 64 it sat beside them and collided with
    // the picker on a 390px phone, and at 152 it covered the labels toggle
    // on a 375px phone. The bottom-right corner belongs to MapLibre's
    // geolocate + attribution controls.
    position: "absolute" as const,
    bottom: 192,
    left: "50%",
    transform: "translateX(-50%)",
    maxWidth: "min(60vw, 320px)",
    padding: "8px 14px",
    minHeight: 44,
    border: `1px solid ${dark ? "#4b5563" : "#d1d5db"}`,
    borderRadius: 22,
    background: dark ? "#1f2937" : "white",
    color: dark ? "#f9fafb" : "#111827",
    whiteSpace: "nowrap" as const,
    overflow: "hidden",
    textOverflow: "ellipsis",
  };

  // An error replaces the chip rather than stacking a second toast: both are
  // answers to the same question ("where am I relative to the network?").
  if (errorCode !== null) {
    return (
      <div role="status" style={style}>
        {t(ERROR_KEYS[errorCode] ?? "geolocate_unavailable", "en")}
      </div>
    );
  }

  const { station, distanceMeters } = nearest!;
  return (
    <button
      type="button"
      onClick={() => onSelect(station)}
      style={{ ...style, cursor: "pointer" }}
    >
      {t("nearest_station", "en")}: {station.name_en ?? station.name_th} -{" "}
      {formatDistance(distanceMeters)}
    </button>
  );
}

// apps/web/components/NearestStationChip.tsx
"use client";

import type { StationWithStatus } from "../lib/types";
import { t } from "../lib/i18n";
import { ChevronIcon, PinIcon } from "./icons";

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

// A row at the top of the sheet once the map's locate button has a fix -
// the answer to "where can I board now" sits where the eye already is.
export function NearestStationChip({
  nearest,
  errorCode,
  onSelect,
}: {
  nearest: { station: StationWithStatus; distanceMeters: number } | null;
  errorCode: number | null;
  onSelect: (station: StationWithStatus) => void;
}) {
  if (!nearest && errorCode === null) return null;

  // An error replaces the row rather than stacking a second notice: both are
  // answers to the same question ("where am I relative to the network?").
  if (errorCode !== null) {
    return (
      <section className="section">
        <div className="list" role="status">
          <div className="row">
            <span className="row-leading">
              <PinIcon />
            </span>
            <span className="row-main row-sub">
              {t(ERROR_KEYS[errorCode] ?? "geolocate_unavailable", "en")}
            </span>
          </div>
        </div>
      </section>
    );
  }

  const { station, distanceMeters } = nearest!;
  return (
    <section className="section">
      <div className="list">
        <button type="button" className="row" onClick={() => onSelect(station)}>
          <span
            className="row-leading"
            style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
          >
            <PinIcon />
          </span>
          <span className="row-main">
            <span className="row-sub" style={{ display: "block" }}>
              {t("nearest_station", "en")} · {formatDistance(distanceMeters)}
            </span>
            <span className="row-title" style={{ display: "block" }}>
              {station.name_en ?? station.name_th}
            </span>
          </span>
          <ChevronIcon />
        </button>
      </div>
    </section>
  );
}

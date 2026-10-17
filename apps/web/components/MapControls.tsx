// apps/web/components/MapControls.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import type * as maplibregl from "maplibre-gl";
import { t } from "../lib/i18n";
import { LocateIcon, LocateOffIcon, MinusIcon, PlusIcon } from "./icons";

// Tilt used for the 3D view. 60 is MapLibre's own max for a comfortable
// perspective that still reads as a map; past it the horizon dominates.
const PITCH_3D = 60;
// Below this the view counts as flat, so a slight accidental tilt from a
// two-finger gesture doesn't flip the button's label.
const FLAT_PITCH = 5;

// What the locate button shows. Mirrors GeolocateControl's watch states:
// "waiting" for the first fix, "active" following the user, "background"
// when the user has panned away from their dot (still tracking).
type LocateState = "off" | "waiting" | "active" | "background" | "denied";

/**
 * Glass map controls, bottom-right: locate, 2D/3D tilt, compass, zoom.
 *
 * Locate drives MapLibre's own GeolocateControl (its button is hidden in
 * globals.css): the control owns the user dot, accuracy circle and
 * tracking, so this only adds a button that matches the rest of the UI.
 */
export function MapControls({
  map,
  geolocate,
}: {
  map: maplibregl.Map;
  geolocate: maplibregl.GeolocateControl;
}) {
  const [locate, setLocate] = useState<LocateState>("off");
  const [tilted, setTilted] = useState(() => map.getPitch() > FLAT_PITCH);
  const [atMinZoom, setAtMinZoom] = useState(false);
  const [atMaxZoom, setAtMaxZoom] = useState(false);
  const needleRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    // The compass turns every frame of a rotation, so it is written straight
    // to the DOM rather than through React state. Tilting it with the pitch
    // (like MapLibre's own compass) shows the 3D view at a glance.
    const syncCompass = () => {
      const needle = needleRef.current;
      if (!needle) return;
      needle.style.transform = `rotateX(${map.getPitch()}deg) rotate(${-map.getBearing()}deg)`;
    };
    const syncPitch = () => setTilted(map.getPitch() > FLAT_PITCH);
    const syncZoom = () => {
      setAtMinZoom(map.getZoom() <= map.getMinZoom());
      setAtMaxZoom(map.getZoom() >= map.getMaxZoom());
    };
    syncCompass();
    syncZoom();

    map.on("rotate", syncCompass);
    map.on("pitch", syncCompass);
    map.on("pitchend", syncPitch);
    map.on("zoomend", syncZoom);
    return () => {
      map.off("rotate", syncCompass);
      map.off("pitch", syncCompass);
      map.off("pitchend", syncPitch);
      map.off("zoomend", syncZoom);
    };
  }, [map]);

  useEffect(() => {
    const onActive = () => setLocate("active");
    const onBackground = () => setLocate("background");
    const onEnd = () =>
      // `trackuserlocationend` also fires when the user pans away; the
      // control then keeps tracking in the background.
      setLocate((s) => (s === "active" ? "background" : "off"));
    const onError = (e: { code: number }) =>
      setLocate(e.code === 1 ? "denied" : "off");

    geolocate.on("geolocate", onActive);
    geolocate.on("userlocationfocus", onActive);
    geolocate.on("userlocationlostfocus", onBackground);
    geolocate.on("trackuserlocationend", onEnd);
    geolocate.on("error", onError);
    return () => {
      geolocate.off("geolocate", onActive);
      geolocate.off("userlocationfocus", onActive);
      geolocate.off("userlocationlostfocus", onBackground);
      geolocate.off("trackuserlocationend", onEnd);
      geolocate.off("error", onError);
    };
  }, [geolocate]);

  const onLocate = () => {
    // Pressing while following stops tracking (GeolocateControl's own
    // toggle); from any other state it starts or refocuses.
    if (locate === "active") setLocate("off");
    else if (locate !== "background") setLocate("waiting");
    geolocate.trigger();
  };

  const following = locate === "active" || locate === "waiting";
  const locateLabel = t(
    locate === "active" ? "locate_stop" : "locate_me",
    "en",
  );
  const tiltLabel = t(tilted ? "view_2d" : "view_3d", "en");

  return (
    <div className="map-controls" role="group" aria-label="Map controls">
      <button
        type="button"
        className="map-btn"
        data-state={locate}
        aria-label={locateLabel}
        title={locateLabel}
        aria-pressed={following}
        onClick={onLocate}
      >
        {locate === "denied" ? (
          <LocateOffIcon />
        ) : (
          <LocateIcon filled={locate === "active"} />
        )}
      </button>

      {/* Shows the view it switches to, as in Apple Maps. */}
      <button
        type="button"
        className="map-btn map-btn-text"
        aria-label={tiltLabel}
        title={tiltLabel}
        onClick={() =>
          map.easeTo({ pitch: tilted ? 0 : PITCH_3D, duration: 500 })
        }
      >
        {tilted ? "2D" : "3D"}
      </button>

      <button
        type="button"
        className="map-btn"
        aria-label={t("reset_north", "en")}
        title={t("reset_north", "en")}
        onClick={() => map.easeTo({ bearing: 0, duration: 400 })}
      >
        <span ref={needleRef} className="compass" aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24">
            <path d="M12 2.5 15.5 12h-7L12 2.5Z" fill="#ff3b30" />
            <path d="M12 21.5 8.5 12h7L12 21.5Z" fill="currentColor" />
          </svg>
        </span>
      </button>

      <div className="map-zoom">
        <button
          type="button"
          className="map-btn"
          aria-label={t("zoom_out", "en")}
          title={t("zoom_out", "en")}
          disabled={atMinZoom}
          onClick={() => map.zoomOut()}
        >
          <MinusIcon />
        </button>
        <button
          type="button"
          className="map-btn"
          aria-label={t("zoom_in", "en")}
          title={t("zoom_in", "en")}
          disabled={atMaxZoom}
          onClick={() => map.zoomIn()}
        >
          <PlusIcon />
        </button>
      </div>
    </div>
  );
}

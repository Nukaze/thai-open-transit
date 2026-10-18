// apps/web/components/MapControls.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import type * as maplibregl from "maplibre-gl";
import { useLang } from "../lib/lang";
import { t } from "../lib/i18n";
import {
  LocateIcon,
  LocateOffIcon,
  MinusIcon,
  PlusIcon,
  ResetViewIcon,
  SlidersIcon,
  TiltIcon,
} from "./icons";

// Tilt used for the 3D view. 60 is MapLibre's own max for a comfortable
// perspective that still reads as a map; past it the horizon dominates.
const PITCH_3D = 60;
// Below this the view counts as flat, so a slight accidental tilt from a
// two-finger gesture doesn't flip the button's label.
const FLAT_PITCH = 5;
// One press of tilt up/down. Presses snap to multiples of it, so after a
// free two-finger tilt the steps still land on round angles.
const PITCH_STEP = 15;

// What the locate button shows. Mirrors GeolocateControl's watch states:
// "waiting" for the first fix, "active" following the user, "background"
// when the user has panned away from their dot (still tracking).
type LocateState = "off" | "waiting" | "active" | "background" | "denied";

/**
 * Glass map controls, bottom-right: locate, 2D/3D tilt, compass, zoom.
 * Reset view sits in the default row; a sliders button opens a second row
 * above with a tilt slider for users who want finer control. Phones also
 * move zoom into that row - people pinch there, as Apple and Google Maps
 * assume - which keeps the default row inside a 360px screen.
 *
 * Locate drives MapLibre's own GeolocateControl (its button is hidden in
 * globals.css): the control owns the user dot, accuracy circle and
 * tracking, so this only adds a button that matches the rest of the UI.
 */
export function MapControls({
  map,
  geolocate,
  home,
}: {
  map: maplibregl.Map;
  geolocate: maplibregl.GeolocateControl;
  home: { center: [number, number]; zoom: number };
}) {
  const lang = useLang();
  const [locate, setLocate] = useState<LocateState>("off");
  const [tilted, setTilted] = useState(() => map.getPitch() > FLAT_PITCH);
  const [atMinZoom, setAtMinZoom] = useState(false);
  const [atMaxZoom, setAtMaxZoom] = useState(false);
  const [atMinPitch, setAtMinPitch] = useState(true);
  const [atMaxPitch, setAtMaxPitch] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const needleRef = useRef<HTMLSpanElement>(null);
  const tiltSliderRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // The compass turns every frame of a rotation, so it is written straight
    // to the DOM rather than through React state. Tilting it with the pitch
    // (like MapLibre's own compass) shows the 3D view at a glance.
    // The tilt slider follows the same way, so it tracks two-finger tilts
    // and eased steps frame by frame without re-rendering.
    const syncCompass = () => {
      const slider = tiltSliderRef.current;
      if (slider) slider.value = String(map.getPitch());
      const needle = needleRef.current;
      if (!needle) return;
      needle.style.transform = `rotateX(${map.getPitch()}deg) rotate(${-map.getBearing()}deg)`;
    };
    const syncPitch = () => {
      const pitch = map.getPitch();
      setTilted(pitch > FLAT_PITCH);
      setAtMinPitch(pitch <= map.getMinPitch());
      setAtMaxPitch(pitch >= map.getMaxPitch());
    };
    const syncZoom = () => {
      setAtMinZoom(map.getZoom() <= map.getMinZoom());
      setAtMaxZoom(map.getZoom() >= map.getMaxZoom());
    };
    syncCompass();
    syncPitch();
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
    lang,
  );
  const tiltLabel = t(tilted ? "view_2d" : "view_3d", lang);

  const tiltBy = (steps: number) => {
    const snapped = Math.round(map.getPitch() / PITCH_STEP) * PITCH_STEP;
    const pitch = Math.min(
      map.getMaxPitch(),
      Math.max(map.getMinPitch(), snapped + steps * PITCH_STEP),
    );
    map.easeTo({ pitch, duration: 300 });
  };

  // Rendered twice, each copy hidden by CSS at the other breakpoint: in the
  // default row on desktop, in the advanced row on phones.
  const zoom = (where: "wide" | "narrow") => (
    <div className={`map-zoom map-zoom-${where}`}>
      <button
        type="button"
        className="map-btn"
        aria-label={t("zoom_out", lang)}
        title={t("zoom_out", lang)}
        disabled={atMinZoom}
        onClick={() => map.zoomOut()}
      >
        <MinusIcon />
      </button>
      <button
        type="button"
        className="map-btn"
        aria-label={t("zoom_in", lang)}
        title={t("zoom_in", lang)}
        disabled={atMaxZoom}
        onClick={() => map.zoomIn()}
      >
        <PlusIcon />
      </button>
    </div>
  );

  return (
    <div
      className="map-controls"
      data-advanced={advanced || undefined}
      role="group"
      aria-label={t("map_controls", lang)}
    >
      {advanced && (
        <div
          id="map-controls-advanced"
          className="map-controls-row"
          role="group"
          aria-label={t("more_controls", lang)}
        >
          {zoom("narrow")}

          {/* Vertical, top to bottom: tilt up, slider, tilt down. The end
              buttons step 15 degrees; the slider takes any angle. A native
              range input keeps arrow keys and screen readers. */}
          <div className="map-zoom map-tilt">
            <button
              type="button"
              className="map-btn"
              aria-label={t("tilt_up", lang)}
              title={t("tilt_up", lang)}
              disabled={atMaxPitch}
              onClick={() => tiltBy(1)}
            >
              <TiltIcon direction="up" />
            </button>
            <div className="tilt-track">
              <input
                aria-orientation="vertical"
                ref={tiltSliderRef}
                type="range"
                className="tilt-slider"
                aria-label={t("tilt", lang)}
                min={map.getMinPitch()}
                max={map.getMaxPitch()}
                step={1}
                defaultValue={map.getPitch()}
                onChange={(e) => map.setPitch(Number(e.currentTarget.value))}
              />
            </div>
            <button
              type="button"
              className="map-btn"
              aria-label={t("tilt_down", lang)}
              title={t("tilt_down", lang)}
              disabled={atMinPitch}
              onClick={() => tiltBy(-1)}
            >
              <TiltIcon direction="down" />
            </button>
          </div>
        </div>
      )}

      <div className="map-controls-row">
        <button
          type="button"
          className="map-btn"
          aria-label={t("more_controls", lang)}
          title={t("more_controls", lang)}
          aria-expanded={advanced}
          aria-controls={advanced ? "map-controls-advanced" : undefined}
          onClick={() => setAdvanced((a) => !a)}
        >
          <SlidersIcon />
        </button>

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
          aria-label={t("reset_north", lang)}
          title={t("reset_north", lang)}
          onClick={() => map.easeTo({ bearing: 0, duration: 400 })}
        >
          <span ref={needleRef} className="compass" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24">
              <path d="M12 2.5 15.5 12h-7L12 2.5Z" fill="#ff3b30" />
              <path d="M12 21.5 8.5 12h7L12 21.5Z" fill="currentColor" />
            </svg>
          </span>
        </button>

        {/* Back to the first-load camera: Bangkok overview, north up, flat.
            A deliberate move, so it also leaves follow-my-location
            (GeolocateControl drops to background on any camera move). */}
        <button
          type="button"
          className="map-btn"
          aria-label={t("reset_view", lang)}
          title={t("reset_view", lang)}
          onClick={() =>
            map.flyTo({ ...home, bearing: 0, pitch: 0, speed: 1.6 })
          }
        >
          <ResetViewIcon />
        </button>

        {zoom("wide")}
      </div>
    </div>
  );
}

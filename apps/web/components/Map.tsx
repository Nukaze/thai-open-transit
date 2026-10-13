// apps/web/components/Map.tsx
"use client";

import { useEffect, useRef } from "react";
// maplibre-gl@6 ships ESM-only with no default export (verified against the
// installed package's .d.ts - Turbopack: "Export default doesn't exist");
// the brief's `import maplibregl from 'maplibre-gl'` doesn't resolve. A
// namespace import preserves every other line unchanged (maplibregl.Map,
// maplibregl.addProtocol, maplibregl.removeProtocol all exist as named
// exports).
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Protocol } from "pmtiles";
import { layers, namedFlavor } from "@protomaps/basemaps";
import { PUBLIC_BASE_URL } from "../lib/constants";
import type { Feature, FeatureCollection, Point, LineString } from "geojson";

const BANGKOK_CENTER: [number, number] = [100.5018, 13.7563];

export type MapTheme = "light" | "dark";

// `StyleSpecification` lives in `@maplibre/maplibre-gl-style-spec`, which is a
// transitive dependency here, not a declared one - importing it directly would
// mean depending on a package apps/web never installed. `MapOptions["style"]`
// is the same type reached through maplibre-gl's own public exports.
type MapStyle = NonNullable<maplibregl.MapOptions["style"]>;

// The network overlay sits on top of the basemap, so its colors have to move
// with the flavor: what reads against the light flavor's near-white land
// disappears into the dark flavor's near-black land, and vice versa. Kept
// adjacent to the flavor name so the two cannot drift apart.
//
// Station dots and badge rings take their own line's color (`ring_color`,
// resolved in HomeClient); `interchange` is the neutral ring for a station
// two visible lines share, where picking one line's color would misstate it.
// Badge TEXT is never line-colored: yellow (#FFD400) and gold (#A58704) on a
// white badge are unreadable, so the line color stays on the ring and the
// code uses the theme's ink.
interface OverlayColors {
  suspended: string;
  interchange: string;
  dotStroke: string;
  badgeFill: string;
  badgeText: string;
  nameTh: string;
  nameEn: string;
  halo: string;
}
const OVERLAY_COLORS: Record<MapTheme, OverlayColors> = {
  light: {
    suspended: "#9ca3af",
    interchange: "#111827",
    dotStroke: "#ffffff",
    badgeFill: "#ffffff",
    badgeText: "#111827",
    nameTh: "#111827",
    nameEn: "#4b5563",
    halo: "#ffffff",
  },
  dark: {
    suspended: "#6b7280",
    interchange: "#e5e7eb",
    dotStroke: "#0f172a",
    badgeFill: "#0f172a",
    badgeText: "#f8fafc",
    nameTh: "#f1f5f9",
    nameEn: "#94a3b8",
    halo: "#0b1220",
  },
};

// Layers the station-labels toggle shows and hides together.
const LABEL_LAYER_IDS = ["station-names", "station-badges"] as const;

// Badge images are generated on demand (see `drawBadgeImage`) under an id
// that encodes both colors, so the style can request any fill/ring pair by
// expression and the `styleimagemissing` handler can rebuild it from the id
// alone - including after a theme switch's `setStyle`, which drops every
// image added at runtime.
const BADGE_IMAGE_PREFIX = "badge|";

// A rounded rectangle drawn at 2x and declared stretchable, so
// `icon-text-fit` grows it around a 2-character code ("A1"), a 4-character
// one ("BL15"), or a stacked two-code interchange (PP16 over BL10) without
// distorting the corners. Coordinates below are in 2x image pixels.
const BADGE_PX = 40;
const BADGE_RADIUS = 14;
const BADGE_BORDER = 5;

function drawBadgeImage(
  fill: string,
  ring: string,
): {
  image: ImageData;
  options: Parameters<maplibregl.Map["addImage"]>[2];
} | null {
  const canvas = document.createElement("canvas");
  canvas.width = BADGE_PX;
  canvas.height = BADGE_PX;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const inset = BADGE_BORDER / 2;
  ctx.beginPath();
  ctx.roundRect(
    inset,
    inset,
    BADGE_PX - BADGE_BORDER,
    BADGE_PX - BADGE_BORDER,
    BADGE_RADIUS,
  );
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = BADGE_BORDER;
  ctx.strokeStyle = ring;
  ctx.stroke();
  return {
    image: ctx.getImageData(0, 0, BADGE_PX, BADGE_PX),
    options: {
      pixelRatio: 2,
      // Only the straight middle band stretches; the corners stay fixed.
      stretchX: [[BADGE_RADIUS + 2, BADGE_PX - BADGE_RADIUS - 2]],
      stretchY: [[BADGE_RADIUS + 2, BADGE_PX - BADGE_RADIUS - 2]],
      // The box the code text is fitted into: inside the border, with a
      // little more side padding than top/bottom, like a printed roundel.
      content: [12, 8, BADGE_PX - 12, BADGE_PX - 8],
    },
  };
}

// Fallback only - `HomeClient` always passes an explicit `selectionRingColor`
// (one value per `MapTheme`, user-configurable via `SelectionRingColorPicker`),
// so
// this is just what a bare `<Map>` with the prop omitted falls back to.
const DEFAULT_SELECTION_RING_COLOR = "#FFFFFF";

// Selection ring pulse: a slow breathe on stroke width/opacity rather than on
// `circle-radius` - the radius is a zoom-interpolated expression (see
// `station-selection`'s paint below), and re-issuing a full expression every
// animation frame is far more work than updating two plain numbers.
const PULSE_PERIOD_MS = 1800;
const PULSE_STROKE_WIDTH = { min: 2.5, max: 4.5 };
const PULSE_STROKE_OPACITY = { min: 0.45, max: 1 };

// `FilterSpecification` isn't a type maplibre-gl re-exports on its own (only
// `@maplibre/maplibre-gl-style-spec`, a transitive dependency, does) - same
// situation as `MapStyle` above, so pulled the same way: off a public method
// that already carries the type, rather than depending on the package
// directly.
type MapFilter = NonNullable<Parameters<maplibregl.Map["setFilter"]>[1]>;

// `ExpressionSpecification` isn't re-exported either; the array (expression)
// branch of a circle color is the same type, reached through `AddLayerObject`.
type CirclePaint = NonNullable<
  Extract<maplibregl.AddLayerObject, { type: "circle" }>["paint"]
>;
type ColorExpression = Extract<CirclePaint["circle-color"], unknown[]>;

function selectionFilter(id: string | null): MapFilter {
  return ["==", ["get", "id"], id ?? ""];
}

// Stations render as a circle layer and segments as a line layer, and a
// MapLibre layer's `type` fixes the geometry it draws - a "circle" layer
// against a source that also holds LineStrings just ignores them, but
// filtering that out per-render is wasted work. Segments therefore get their
// own source, and this splits the single collection the parent passes down
// into the two the map actually needs.
function splitFeatures(collection: FeatureCollection<Point | LineString>): {
  points: FeatureCollection<Point>;
  lines: FeatureCollection<LineString>;
} {
  return {
    points: {
      type: "FeatureCollection",
      features: collection.features.filter(
        (f): f is Feature<Point> => f.geometry.type === "Point",
      ),
    },
    lines: {
      type: "FeatureCollection",
      features: collection.features.filter(
        (f): f is Feature<LineString> => f.geometry.type === "LineString",
      ),
    },
  };
}

// MapLibre's `normalizeSpriteURL` rejects a relative sprite path outright
// ("Invalid sprite URL ..., must be absolute"), unlike `glyphs` and source
// `url`, which it resolves against the document. `PUBLIC_BASE_URL` is empty by
// design (CLAUDE.md 3: never hardcode the deployment domain), so the origin is
// read from the browser at runtime instead - which keeps the artifact portable
// across vercel.app, a future custom domain, and localhost, and still honours
// `PUBLIC_BASE_URL` if one is ever configured. Safe to touch `window` here:
// `Map` is only ever mounted through `next/dynamic` with `ssr: false`.
// Must resolve to an ORIGIN, not a path prefix: a bare path here (say
// "/bangkok-open-transit" for a subpath deployment) would make the sprite URL
// relative again, which is exactly what MapLibre rejects.
function assetOrigin(): string {
  return PUBLIC_BASE_URL || window.location.origin;
}

function buildStyle(theme: MapTheme): MapStyle {
  const origin = assetOrigin();
  return {
    version: 8,
    glyphs: `${origin}/basemap/fonts/{fontstack}/{range}.pbf`,
    // Both flavors' sprite sheets are vendored under public/basemap/sprites/
    // from protomaps/basemaps-assets v4, the same source `generate_style`
    // points at, because the public plane must not fetch from a third-party
    // host at runtime (CLAUDE.md 2.4).
    sprite: `${origin}/basemap/sprites/${theme}`,
    sources: {
      protomaps: {
        type: "vector",
        url: `pmtiles://${origin}/basemap/bangkok.pmtiles`,
        attribution: "© OpenStreetMap contributors",
      },
    },
    layers: layers("protomaps", namedFlavor(theme), { lang: "en" }),
  };
}

// Every source and layer below is added at runtime rather than declared in the
// style, so `setStyle` (the theme switch) discards all of it. Extracted into
// one function so the theme effect can rebuild exactly what the init path
// built, with no second copy of the layer definitions to keep in sync.
function addNetworkLayers(
  map: maplibregl.Map,
  theme: MapTheme,
  collection: FeatureCollection<Point | LineString>,
  selectedStationId: string | null,
  selectionRingColor: string,
  showStationLabels: boolean,
): void {
  // Idempotent: `style.load` can fire more than once per style if the theme
  // is toggled again while the previous style is still loading (a full sprite
  // + basemap reload leaves a wide window). A second `addSource("network")`
  // on a style that already has one throws "There is already a source with
  // ID", so the duplicate call is dropped here instead.
  if (map.getSource("network")) return;

  const { points, lines } = splitFeatures(collection);
  const colors = OVERLAY_COLORS[theme];

  // One expression for a station's line color, shared by the dot and the
  // badge ring so the two can never disagree: grey when suspended, the
  // line's own color when one visible line serves it, the neutral
  // interchange color when two do (`ring_color` is null then).
  const ringColor: ColorExpression = [
    "case",
    ["==", ["get", "status"], "suspended"],
    colors.suspended,
    ["coalesce", ["get", "ring_color"], colors.interchange],
  ];

  map.addSource("network", {
    type: "geojson",
    data: points,
  });
  map.addSource("network-lines", {
    type: "geojson",
    data: lines,
  });

  // Segment rendering, per SPEC 3.3's status table. Added before the
  // station layers so segments draw underneath the station dots, matching
  // conventional transit-map z-ordering.
  map.addLayer({
    id: "segments",
    type: "line",
    source: "network-lines",
    // `proposed` and `cancelled` are "hidden by default" in SPEC 3.3, so
    // they are filtered out of the layer rather than drawn at zero
    // opacity - a zero-opacity line is still tiled and still answers
    // queryRenderedFeatures, which is not the same thing as hidden.
    filter: [
      "!",
      ["in", ["get", "status"], ["literal", ["proposed", "cancelled"]]],
    ],
    layout: { "line-cap": "round", "line-join": "round" },
    paint: {
      // `suspended` overrides the line's brand color with grey; every
      // other status keeps `color`, which `scripts/build/assemble.ts`
      // denormalises onto each feature from the segment's parent Line
      // (MapLibre paint expressions can only read feature properties).
      "line-color": [
        "case",
        ["==", ["get", "status"], "suspended"],
        colors.suspended,
        ["get", "color"],
      ],
      // SPEC 3.3 asks for an "outline" treatment for `planned`. MapLibre
      // has no outline-stroke-only paint for a line layer the way it has
      // `fill-outline-color` for a polygon, so a thin, low-opacity stroke
      // stands in for it. Recorded here rather than silently approximated.
      "line-width": ["match", ["get", "status"], "planned", 1.5, 3],
      "line-opacity": [
        "match",
        ["get", "status"],
        "approved",
        0.5,
        "planned",
        0.6,
        1,
      ],
      // `line-dasharray` is `cross-faded-data-driven` in this MapLibre
      // version - verified against the bundled style-spec reference, whose
      // entry for it lists `"parameters": ["zoom", "feature"]` - so a
      // `get`-based `match` is valid and dashed/solid need not be split
      // across two layers.
      //
      // `[1]` (a single continuous dash, no gap) is the solid case, not
      // `[1, 0]`. A trailing zero would add a zero-length gap range, and
      // `LineAtlas.addRoundDash` - which is what runs here, since
      // `line-cap` is `round` - has none of the zero-length range cleanup
      // that `addRegularDash` does. An odd-length array is the documented
      // way to express a pattern with no gap.
      "line-dasharray": [
        "match",
        ["get", "status"],
        ["under_construction", "approved"],
        ["literal", [2, 2]],
        ["literal", [1]],
      ],
    },
  });

  // No clustering: the dataset is the product (CLAUDE.md 1), so every
  // station stays individually visible and clickable at every zoom level
  // rather than being merged into an unlabelled aggregate dot. Radius
  // interpolates down at low zoom instead, so dense interchanges (e.g. Siam)
  // don't fully overlap when zoomed out to the whole metro region.
  //
  // The dot is the one marker guaranteed for every station: the code badge
  // drawn over it (below) takes part in label collision and can be dropped
  // in a crowded view, so the dot stays small enough to sit inside a badge
  // when one does show, and still marks the station when one doesn't.
  map.addLayer({
    id: "stations",
    type: "circle",
    source: "network",
    paint: {
      "circle-radius": [
        "interpolate",
        ["linear"],
        ["zoom"],
        8,
        2.5,
        12,
        5,
        16,
        7,
      ],
      "circle-color": ringColor,
      "circle-stroke-color": colors.dotStroke,
      "circle-stroke-width": 1,
    },
  });

  const labelVisibility = showStationLabels ? "visible" : "none";

  // Station names: Thai over English, beside the node. Added BELOW the
  // badge layer on purpose - MapLibre places symbols top layer first, so a
  // badge claims its space before a name does, and the name then tries the
  // other anchors in `text-variable-anchor-offset` to get out of its way
  // rather than covering it. Collision (`text-overlap` left at its default
  // "never") also lets our names push the basemap's place labels aside,
  // since the basemap's layers sit below these.
  //
  // `show_name` (HomeClient's `pickLabelledStations`) is false for all but one
  // member of a same-name interchange, so Lat Phrao (BL15 + YL01) prints once.
  //
  // Every `text-font` is a single fontstack, never a fallback list: glyph
  // requests go to `/basemap/fonts/{fontstack}/...`, and a list is requested
  // as ONE comma-joined fontstack directory that does not exist in the static
  // export, which would 404 and drop the labels with no error shown.
  map.addLayer({
    id: "station-names",
    type: "symbol",
    source: "network",
    minzoom: 12,
    filter: ["==", ["get", "show_name"], true],
    layout: {
      visibility: labelVisibility,
      // Thai only at 12, the English line joins from 13 - at 12 a
      // two-line label per station crowds out more names than it adds.
      "text-field": [
        "step",
        ["zoom"],
        ["format", ["get", "name_th"], {}],
        13,
        [
          "format",
          ["get", "name_th"],
          {},
          "\n",
          {},
          ["coalesce", ["get", "name_en"], ""],
          {
            "text-font": ["literal", ["Noto Sans Regular"]],
            "font-scale": 0.8,
            "text-color": colors.nameEn,
          },
        ],
      ],
      "text-font": ["Noto Sans Medium"],
      "text-size": ["interpolate", ["linear"], ["zoom"], 12, 12, 16, 15],
      "text-line-height": 1.15,
      "text-max-width": 14,
      // Offsets in ems, measured from the station point: far enough sideways
      // to clear a four-character badge ("BL15"), less far above/below,
      // where the badge is only one text line tall.
      "text-variable-anchor-offset": [
        "literal",
        [
          "left",
          [2.2, 0],
          "right",
          [-2.2, 0],
          "top",
          [0, 1.1],
          "bottom",
          [0, -1.1],
        ],
      ],
      "text-justify": "auto",
      "symbol-sort-key": ["get", "label_rank"],
    },
    paint: {
      "text-color": colors.nameTh,
      "text-halo-color": colors.halo,
      "text-halo-width": 1.5,
    },
  });

  // Code badges: the station's current code(s) - A1, YL12, BL20, N3, CEN,
  // RN06 - in a rounded roundel ringed in the line's color, drawn over the
  // dot. The badge image is generated per (fill, ring) pair on first request
  // (see the `styleimagemissing` handler in the init effect).
  //
  // Badges collide with each other: at the default zoom-11 overview, letting
  // all 192 overlap would bury the map in a pile of pills, so the busiest
  // spots show a subset and fill in as the user zooms. `label_rank` places
  // interchange badges first so they are the last to drop out.
  map.addLayer({
    id: "station-badges",
    type: "symbol",
    source: "network",
    filter: ["!=", ["get", "codes"], ""],
    layout: {
      visibility: labelVisibility,
      "text-field": ["get", "codes"],
      "text-font": ["Noto Sans Medium"],
      "text-size": ["interpolate", ["linear"], ["zoom"], 10, 9, 14, 11, 16, 12],
      "text-line-height": 1.1,
      "icon-image": [
        "concat",
        BADGE_IMAGE_PREFIX,
        colors.badgeFill,
        "|",
        ringColor,
      ],
      "icon-text-fit": "both",
      "icon-text-fit-padding": [1, 2, 1, 2],
      "symbol-sort-key": ["get", "label_rank"],
    },
    paint: {
      "text-color": colors.badgeText,
    },
  });

  // Selection ring: a hollow stroke-only circle (`circle-color: transparent`)
  // drawn on top of, and larger than, the station dot it's marking - reads as
  // a ring around the selected station rather than replacing its dot.
  // Starts filtered to match nothing (`selectionFilter(null)`) rather than
  // omitted, so the layer exists and `setFilter` (below) always has a target
  // even before a station is ever clicked.
  map.addLayer({
    id: "station-selection",
    type: "circle",
    source: "network",
    filter: selectionFilter(selectedStationId),
    paint: {
      "circle-radius": [
        "interpolate",
        ["linear"],
        ["zoom"],
        // Sized to clear a code badge (about 18px tall, 36px wide for a
        // four-character code) rather than just the dot under it, so the
        // ring reads around the badge instead of slicing through its text.
        8,
        9,
        12,
        17,
        16,
        24,
      ],
      "circle-color": "transparent",
      "circle-stroke-color": selectionRingColor,
      "circle-stroke-width": PULSE_STROKE_WIDTH.min,
      "circle-stroke-opacity": PULSE_STROKE_OPACITY.min,
    },
  });
}

export function Map({
  networkGeoJson,
  onStationClick,
  theme = "light",
  selectedStationId = null,
  selectionRingColor = DEFAULT_SELECTION_RING_COLOR,
  showStationLabels = true,
}: {
  networkGeoJson: FeatureCollection<Point | LineString>;
  onStationClick?: (id: string) => void;
  theme?: MapTheme;
  selectedStationId?: string | null;
  selectionRingColor?: string;
  showStationLabels?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  // `onStationClick`, `networkGeoJson` and `theme` are read through refs
  // inside the init effect below instead of being listed in its dependency
  // array. The init effect must run exactly once: it calls
  // `addProtocol('pmtiles', ...)`, which "must only be called once per app
  // lifecycle" (Protomaps docs), and re-running it on every line-filter
  // toggle (which produces a new `networkGeoJson` object each time) would
  // tear down and rebuild the whole MapLibre instance - destroying the
  // protocol, resetting zoom/center to `BANGKOK_CENTER`, and re-registering
  // the protocol on top of itself.
  const onStationClickRef = useRef(onStationClick);
  const networkGeoJsonRef = useRef(networkGeoJson);
  const themeRef = useRef(theme);
  const selectedStationIdRef = useRef(selectedStationId);
  const selectionRingColorRef = useRef(selectionRingColor);
  // Read by the `style.load` handler, so a theme switch (which rebuilds every
  // layer) recreates the label layers in the toggle's current state instead
  // of silently turning labels back on.
  const showStationLabelsRef = useRef(showStationLabels);
  onStationClickRef.current = onStationClick;
  networkGeoJsonRef.current = networkGeoJson;
  selectedStationIdRef.current = selectedStationId;
  selectionRingColorRef.current = selectionRingColor;
  showStationLabelsRef.current = showStationLabels;

  // Station-labels toggle: flips the label layers' visibility in place.
  // Guarded by `getLayer` like the selection effect below - this can fire
  // before `style.load` has added the layers, and that first add already
  // reads `showStationLabelsRef`.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    for (const id of LABEL_LAYER_IDS) {
      if (!map.getLayer(id)) continue;
      map.setLayoutProperty(
        id,
        "visibility",
        showStationLabels ? "visible" : "none",
      );
    }
  }, [showStationLabels]);

  // Data updates flow into the already-running map via `source.setData`
  // instead of remounting. Guarded by `getSource` because this can fire
  // before the map's own `load` event has attached the sources. Both sources
  // are updated: the caller's contract is a single FeatureCollection, which
  // this component splits (see `splitFeatures`).
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const { points, lines } = splitFeatures(networkGeoJson);
    (map.getSource("network") as maplibregl.GeoJSONSource | undefined)?.setData(
      points,
    );
    (
      map.getSource("network-lines") as maplibregl.GeoJSONSource | undefined
    )?.setData(lines);
  }, [networkGeoJson]);

  // Selection ring follow: re-filters the `station-selection` layer (added in
  // `addNetworkLayers`) to the newly selected station, or back to matching
  // nothing when the panel is dismissed (`selectedStationId` becomes `null`).
  // Guarded by `getLayer` for the same reason the effect above guards on
  // `getSource` - this can fire before `style.load` has added the layer.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getLayer("station-selection")) return;
    map.setFilter("station-selection", selectionFilter(selectedStationId));
  }, [selectedStationId]);

  // Holds the in-flight pulse loop's frame id across the two call sites
  // below, so either one can safely cancel whatever the other started.
  const pulseFrameRef = useRef<number | null>(null);

  // Selection ring pulse: a slow breathe (stroke width + opacity, see
  // `PULSE_STROKE_WIDTH`/`PULSE_STROKE_OPACITY`) while a station stays
  // selected - the Google-Maps-"you are here" pattern, and a fix for the
  // ring's previous flat, static feel. Only `circle-stroke-*` moves each
  // frame; `circle-radius` stays the zoom-interpolated expression set in
  // `addNetworkLayers`, since rebuilding a full expression every frame is far
  // more work than updating two plain numbers.
  //
  // Reads `selectedStationIdRef`/`selectionRingColorRef` rather than taking
  // them as parameters so the SAME function works from both call sites below:
  // the effect that reacts to a selection/color change, and the `style.load`
  // handler in the init effect. The second call site is not optional - a
  // theme toggle runs `setStyle`, which destroys and recreates every
  // runtime-added layer (see the theme-switch effect's comment), silently
  // orphaning whatever loop was running against the old "station-selection"
  // layer and freezing the ring mid-pulse. Restarting it again here, right
  // after `addNetworkLayers` recreates the layer, is what keeps a selection
  // made before a theme toggle still pulsing after it.
  function syncSelectionRing(map: maplibregl.Map): void {
    if (!map.getLayer("station-selection")) return;
    if (pulseFrameRef.current !== null) {
      cancelAnimationFrame(pulseFrameRef.current);
      pulseFrameRef.current = null;
    }

    map.setPaintProperty(
      "station-selection",
      "circle-stroke-color",
      selectionRingColorRef.current,
    );
    if (selectedStationIdRef.current === null) return;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduceMotion) {
      map.setPaintProperty(
        "station-selection",
        "circle-stroke-width",
        PULSE_STROKE_WIDTH.max,
      );
      map.setPaintProperty(
        "station-selection",
        "circle-stroke-opacity",
        PULSE_STROKE_OPACITY.max,
      );
      return;
    }

    const start = performance.now();
    const tick = (now: number) => {
      // (sin + 1) / 2 maps [-1, 1] to [0, 1], then scaled into each pulse
      // range - a plain 0-1 oscillation would pulse the stroke fully to 0.
      const t =
        (Math.sin(((now - start) / PULSE_PERIOD_MS) * 2 * Math.PI) + 1) / 2;
      map.setPaintProperty(
        "station-selection",
        "circle-stroke-width",
        PULSE_STROKE_WIDTH.min +
          t * (PULSE_STROKE_WIDTH.max - PULSE_STROKE_WIDTH.min),
      );
      map.setPaintProperty(
        "station-selection",
        "circle-stroke-opacity",
        PULSE_STROKE_OPACITY.min +
          t * (PULSE_STROKE_OPACITY.max - PULSE_STROKE_OPACITY.min),
      );
      pulseFrameRef.current = requestAnimationFrame(tick);
    };
    pulseFrameRef.current = requestAnimationFrame(tick);
  }

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    syncSelectionRing(map);
    return () => {
      if (pulseFrameRef.current !== null) {
        cancelAnimationFrame(pulseFrameRef.current);
        pulseFrameRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `syncSelectionRing`
    // reads current values through the refs above, not through these two
    // params; it's recreated every render but behaves identically each time.
  }, [selectedStationId, selectionRingColor]);

  // Theme switch. `setStyle` swaps the basemap flavor and its sprite sheet in
  // place, keeping camera position, so toggling does not re-run the init
  // effect (see why that matters above). It also drops every runtime-added
  // source and layer, hence the re-add once the new style has loaded.
  // The delegated listeners registered on `"stations"` in the init effect do
  // survive: MapLibre resolves the layer at dispatch time, not at bind time,
  // so a layer re-added under the same id keeps working.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || themeRef.current === theme) return;
    themeRef.current = theme;
    map.setStyle(buildStyle(theme), { diff: false });
  }, [theme]);

  useEffect(() => {
    // maplibre-gl v6 is ESM-only and builds its worker from
    // `new URL('./maplibre-gl-worker.mjs', import.meta.url)`. MapLibre's docs
    // name Next.js as the exception where that does not survive bundling: the
    // worker is emitted without the `maplibre-gl-shared.mjs` it imports, so it
    // throws on its first import and then answers nothing. Nothing surfaces -
    // no console error, no `error` event - the map just renders an empty
    // basemap while every tile request stays pending forever. Pointing at the
    // copy in public/ (see scripts/copy-maplibre-worker.ts) is the documented
    // fix. Must run before the first `new maplibregl.Map`.
    maplibregl.setWorkerUrl(`${assetOrigin()}/maplibre/maplibre-gl-worker.mjs`);

    // addProtocol must only be called once per app lifecycle (Protomaps docs).
    const protocol = new Protocol();
    maplibregl.addProtocol("pmtiles", protocol.tile);

    const initialTheme = themeRef.current;
    const map = new maplibregl.Map({
      container: containerRef.current!,
      center: BANGKOK_CENTER,
      zoom: 11,
      style: buildStyle(initialTheme),
    });

    // Code-badge images, built the first time the style asks for one. The
    // `station-badges` layer requests `badge|<fill>|<ring>` by expression, so
    // every fill/ring pair it can produce - per line, per theme, suspended,
    // interchange - is drawn exactly when first needed and never listed by
    // hand. Registered on the map, not the style, so it keeps working after
    // a theme switch's `setStyle` has dropped the previously added images.
    //
    // A resolver, not a `styleimagemissing` listener: since maplibre-gl v6
    // that event is notify-only and an `addImage` inside it no longer
    // satisfies the pending request (v5-to-v6 migration guide) - every badge
    // stayed blank with "Image ... could not be loaded" until this moved.
    map.setMissingStyleImageResolver((id) => {
      if (!id.startsWith(BADGE_IMAGE_PREFIX) || map.hasImage(id)) return;
      const [fill, ring] = id.slice(BADGE_IMAGE_PREFIX.length).split("|");
      if (!fill || !ring) return;
      const badge = drawBadgeImage(fill, ring);
      if (badge) map.addImage(id, badge.image, badge.options);
    });

    // `style.load` fires for the initial style and again after every
    // `setStyle`, so one registration covers both the first paint and each
    // theme swap - no second re-add path to keep in sync, and no pile-up of
    // `once` handlers when the theme is toggled repeatedly.
    map.on("style.load", () => {
      addNetworkLayers(
        map,
        themeRef.current,
        networkGeoJsonRef.current,
        selectedStationIdRef.current,
        selectionRingColorRef.current,
        showStationLabelsRef.current,
      );
      // A theme toggle runs `setStyle`, which fires `style.load` again and
      // destroys/recreates every layer `addNetworkLayers` just re-added -
      // including whatever "station-selection" layer a pulse loop from
      // before the toggle was still animating. Restarting it here (rather
      // than relying only on the prop-driven effect below, which has no
      // reason to re-run on a theme change alone) is what keeps a selection
      // made before the toggle still pulsing after it.
      syncSelectionRing(map);
    });

    map.on("load", () => {
      // Station selection: clicking a station point notifies
      // the parent with the station's id (from GeoJSON `properties.id`, per
      // `assembleNetwork`'s geojson output); the parent looks up the full
      // `Station` record for `StationPanel`, since geojson properties stay
      // minimal per CLAUDE.md 2.5 and never carry the full entity. Reading
      // through the ref (rather than closing over the `onStationClick` prop
      // directly) means this listener, registered once at init, always
      // calls the latest handler even though the init effect never re-runs.
      map.on("click", "stations", (e) => {
        const id = e.features?.[0]?.properties?.id;
        if (typeof id === "string") onStationClickRef.current?.(id);
      });
      map.on("mouseenter", "stations", () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "stations", () => {
        map.getCanvas().style.cursor = "";
      });
    });

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      maplibregl.removeProtocol("pmtiles");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once by
    // design; `networkGeoJson`, `onStationClick` and `theme` flow through the
    // refs above instead, see the comment on those refs.
  }, []);

  return <div ref={containerRef} style={{ width: "100%", height: "100vh" }} />;
}

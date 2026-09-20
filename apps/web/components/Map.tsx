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
// with the flavor: the light flavor's near-white land makes dark navy dots
// readable, and on the dark flavor those same dots disappear into the
// background. Kept adjacent to the flavor name so the two cannot drift apart.
const OVERLAY_COLORS: Record<MapTheme, { station: string; suspended: string }> =
  {
    light: { station: "#1e3a8a", suspended: "#9ca3af" },
    dark: { station: "#bfdbfe", suspended: "#6b7280" },
  };

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
): void {
  // Idempotent: `style.load` can fire more than once per style if the theme
  // is toggled again while the previous style is still loading (a full sprite
  // + basemap reload leaves a wide window). A second `addSource("network")`
  // on a style that already has one throws "There is already a source with
  // ID", so the duplicate call is dropped here instead.
  if (map.getSource("network")) return;

  const { points, lines } = splitFeatures(collection);
  const colors = OVERLAY_COLORS[theme];

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
        2,
        12,
        8,
        16,
        16,
      ],
      "circle-color": colors.station,
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
        8,
        8,
        12,
        14,
        16,
        22,
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
}: {
  networkGeoJson: FeatureCollection<Point | LineString>;
  onStationClick?: (id: string) => void;
  theme?: MapTheme;
  selectedStationId?: string | null;
  selectionRingColor?: string;
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
  onStationClickRef.current = onStationClick;
  networkGeoJsonRef.current = networkGeoJson;
  selectedStationIdRef.current = selectedStationId;
  selectionRingColorRef.current = selectionRingColor;

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

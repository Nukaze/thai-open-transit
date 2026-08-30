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

// The station source has `cluster: true`, and MapLibre feeds a clustered
// GeoJSON source through supercluster, which only accepts Point geometry -
// LineStrings handed to it are dropped before tiling, so segments would be
// silently invisible if both shared one source. Segments therefore get their
// own unclustered source, and this splits the single collection the parent
// passes down into the two the map actually needs.
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

export function Map({
  networkGeoJson,
  onStationClick,
}: {
  networkGeoJson: FeatureCollection<Point | LineString>;
  onStationClick?: (id: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  // `onStationClick` and `networkGeoJson` are read through refs inside the
  // init effect below instead of being listed in its dependency array. The
  // init effect must run exactly once: it calls `addProtocol('pmtiles', ...)`,
  // which "must only be called once per app lifecycle" (Protomaps docs), and
  // re-running it on every line-filter toggle (which produces a new
  // `networkGeoJson` object each time) would tear down and rebuild the whole
  // MapLibre instance - destroying the protocol, resetting zoom/center to
  // `BANGKOK_CENTER`, and re-registering the protocol on top of itself.
  const onStationClickRef = useRef(onStationClick);
  const networkGeoJsonRef = useRef(networkGeoJson);
  onStationClickRef.current = onStationClick;
  networkGeoJsonRef.current = networkGeoJson;

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

  useEffect(() => {
    // addProtocol must only be called once per app lifecycle (Protomaps docs).
    const protocol = new Protocol();
    maplibregl.addProtocol("pmtiles", protocol.tile);

    const map = new maplibregl.Map({
      container: containerRef.current!,
      center: BANGKOK_CENTER,
      zoom: 11,
      style: {
        version: 8,
        glyphs: `${PUBLIC_BASE_URL}/basemap/fonts/{fontstack}/{range}.pbf`,
        sprite: `${PUBLIC_BASE_URL}/basemap/sprites/light`,
        sources: {
          protomaps: {
            type: "vector",
            url: `pmtiles://${PUBLIC_BASE_URL}/basemap/bangkok.pmtiles`,
            attribution: "© OpenStreetMap contributors",
          },
        },
        layers: layers("protomaps", namedFlavor("light"), { lang: "en" }),
      },
    });

    map.on("load", () => {
      const { points, lines } = splitFeatures(networkGeoJsonRef.current);

      map.addSource("network", {
        type: "geojson",
        data: points,
        cluster: true,
        clusterRadius: 40,
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
            "#9ca3af",
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
          // across two layers. `[1, 0]` is the solid case.
          "line-dasharray": [
            "match",
            ["get", "status"],
            ["under_construction", "approved"],
            ["literal", [2, 2]],
            ["literal", [1, 0]],
          ],
        },
      });

      map.addLayer({
        id: "station-clusters",
        type: "circle",
        source: "network",
        filter: ["has", "point_count"],
        paint: { "circle-radius": 16, "circle-color": "#2563eb" },
      });
      map.addLayer({
        id: "stations",
        type: "circle",
        source: "network",
        filter: ["!", ["has", "point_count"]],
        paint: { "circle-radius": 6, "circle-color": "#1e3a8a" },
      });

      // Station selection: clicking an unclustered station point notifies
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
    // design; `networkGeoJson` and `onStationClick` flow through the refs
    // above instead, see the comment on those refs.
  }, []);

  return <div ref={containerRef} style={{ width: "100%", height: "100vh" }} />;
}

// apps/web/components/Map.tsx
'use client';

import { useEffect, useRef } from 'react';
// maplibre-gl@6 ships ESM-only with no default export (verified against the
// installed package's .d.ts - Turbopack: "Export default doesn't exist");
// the brief's `import maplibregl from 'maplibre-gl'` doesn't resolve. A
// namespace import preserves every other line unchanged (maplibregl.Map,
// maplibregl.addProtocol, maplibregl.removeProtocol all exist as named
// exports).
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Protocol } from 'pmtiles';
import { layers, namedFlavor } from '@protomaps/basemaps';
import { PUBLIC_BASE_URL } from '../lib/constants';
import type { FeatureCollection, Point } from 'geojson';

const BANGKOK_CENTER: [number, number] = [100.5018, 13.7563];

export function Map({
  networkGeoJson,
  onStationClick,
}: {
  networkGeoJson: FeatureCollection<Point>;
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
  // before the map's own `load` event has attached the source.
  useEffect(() => {
    const source = mapRef.current?.getSource('network') as
      | maplibregl.GeoJSONSource
      | undefined;
    source?.setData(networkGeoJson);
  }, [networkGeoJson]);

  useEffect(() => {
    // addProtocol must only be called once per app lifecycle (Protomaps docs).
    const protocol = new Protocol();
    maplibregl.addProtocol('pmtiles', protocol.tile);

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
            type: 'vector',
            url: `pmtiles://${PUBLIC_BASE_URL}/basemap/bangkok.pmtiles`,
            attribution: '© OpenStreetMap contributors',
          },
        },
        layers: layers('protomaps', namedFlavor('light'), { lang: 'en' }),
      },
    });

    map.on('load', () => {
      map.addSource('network', {
        type: 'geojson',
        data: networkGeoJsonRef.current,
        cluster: true,
        clusterRadius: 40,
      });
      map.addLayer({
        id: 'station-clusters',
        type: 'circle',
        source: 'network',
        filter: ['has', 'point_count'],
        paint: { 'circle-radius': 16, 'circle-color': '#2563eb' },
      });
      map.addLayer({
        id: 'stations',
        type: 'circle',
        source: 'network',
        filter: ['!', ['has', 'point_count']],
        paint: { 'circle-radius': 6, 'circle-color': '#1e3a8a' },
      });

      // Station selection: clicking an unclustered station point notifies
      // the parent with the station's id (from GeoJSON `properties.id`, per
      // `assembleNetwork`'s geojson output); the parent looks up the full
      // `Station` record for `StationPanel`, since geojson properties stay
      // minimal per CLAUDE.md 2.5 and never carry the full entity. Reading
      // through the ref (rather than closing over the `onStationClick` prop
      // directly) means this listener, registered once at init, always
      // calls the latest handler even though the init effect never re-runs.
      map.on('click', 'stations', (e) => {
        const id = e.features?.[0]?.properties?.id;
        if (typeof id === 'string') onStationClickRef.current?.(id);
      });
      map.on('mouseenter', 'stations', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'stations', () => {
        map.getCanvas().style.cursor = '';
      });
    });

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      maplibregl.removeProtocol('pmtiles');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once by
    // design; `networkGeoJson` and `onStationClick` flow through the refs
    // above instead, see the comment on those refs.
  }, []);

  return <div ref={containerRef} style={{ width: '100%', height: '100vh' }} />;
}

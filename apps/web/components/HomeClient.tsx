// apps/web/components/HomeClient.tsx
'use client';

import { useCallback, useMemo, useState } from 'react';
import { Map as NetworkMap } from './Map';
import { StationPanel } from './StationPanel';
import { LineFilter } from './LineFilter';
import type { Line } from 'schema';
import type { FeatureCollection, Point } from 'geojson';
import type { StationWithStatus } from '../lib/types';

export function HomeClient({
  stations,
  lines,
  networkGeoJson,
}: {
  stations: StationWithStatus[];
  lines: Line[];
  networkGeoJson: FeatureCollection<Point>;
}) {
  const [activeLineIds, setActiveLineIds] = useState(new Set(lines.map((l) => l.id)));
  const [selectedStation, setSelectedStation] = useState<StationWithStatus | null>(null);

  // Stable across re-renders as long as the `stations` prop (loaded once at
  // build time) doesn't change, so it doesn't force `Map`'s effect (which
  // depends on this callback) to tear down and recreate the map on every
  // unrelated render.
  const stationById = useMemo(() => new Map(stations.map((s) => [s.id, s])), [stations]);
  const handleStationClick = useCallback(
    (id: string) => setSelectedStation(stationById.get(id) ?? null),
    [stationById],
  );

  const filteredGeoJson = useMemo(() => {
    const visibleStationIds = new Set(
      stations.filter((s) => s.validity.some((v) => activeLineIds.has(v.line))).map((s) => s.id),
    );
    return {
      ...networkGeoJson,
      features: networkGeoJson.features.filter((f) => visibleStationIds.has(f.properties?.id)),
    } as FeatureCollection<Point>;
  }, [activeLineIds, stations, networkGeoJson]);

  return (
    <>
      <NetworkMap networkGeoJson={filteredGeoJson} onStationClick={handleStationClick} />
      <LineFilter
        lines={lines}
        activeLineIds={activeLineIds}
        onToggle={(id) =>
          setActiveLineIds((prev) => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
          })
        }
      />
      <StationPanel station={selectedStation} onClose={() => setSelectedStation(null)} />
    </>
  );
}

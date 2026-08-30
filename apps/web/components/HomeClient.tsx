// apps/web/components/HomeClient.tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Map as NetworkMap } from "./Map";
import { StationPanel } from "./StationPanel";
import { LineFilter } from "./LineFilter";
import { StationSearch } from "./StationSearch";
import { getStationIdFromUrl, buildStationDeepLink } from "../lib/deep-link";
import type { Line } from "schema";
import type { FeatureCollection, Point, LineString } from "geojson";
import type { StationWithStatus } from "../lib/types";

export function HomeClient({
  stations,
  lines,
  networkGeoJson,
}: {
  stations: StationWithStatus[];
  lines: Line[];
  networkGeoJson: FeatureCollection<Point | LineString>;
}) {
  const [activeLineIds, setActiveLineIds] = useState(
    new Set(lines.map((l) => l.id)),
  );
  const [selectedStation, setSelectedStation] =
    useState<StationWithStatus | null>(null);

  // Stable across re-renders as long as the `stations` prop (loaded once at
  // build time) doesn't change, so it doesn't force `Map`'s effect (which
  // depends on this callback) to tear down and recreate the map on every
  // unrelated render.
  const stationById = useMemo(
    () => new Map(stations.map((s) => [s.id, s])),
    [stations],
  );
  // Deep-link write: selecting a station - from the map or from search -
  // opens its panel and pushes a shareable `?station=` URL via
  // `buildStationDeepLink`, so a copied URL reopens the same station on load
  // (via the read-side effect below). Both selection paths route through
  // this one handler so "shareable deep links" (this task's commit message)
  // actually covers the primary interaction (clicking a station on the map),
  // not just the new search box.
  const handleSelectStation = useCallback((station: StationWithStatus) => {
    setSelectedStation(station);
    window.history.replaceState(null, "", buildStationDeepLink(station.id));
  }, []);

  const handleStationClick = useCallback(
    (id: string) => {
      const station = stationById.get(id);
      if (station) handleSelectStation(station);
      else setSelectedStation(null);
    },
    [stationById, handleSelectStation],
  );

  // Deep-link read: on mount, check the URL for a `?station=` param (per
  // brief Step 7 - originally written against `page.tsx`, redirected here
  // since Task 15 moved all interactive state into this Client Component)
  // and open that station's panel if it exists in this build's data. Runs
  // once per `stationById` identity (stable across re-renders per the
  // `useMemo` above, so effectively "once on mount" in practice) rather than
  // on every render. Uses `setSelectedStation` directly rather than
  // `handleSelectStation` - the URL already has this param, so rewriting it
  // via `replaceState` here would be a harmless but pointless no-op.
  useEffect(() => {
    const stationId = getStationIdFromUrl(window.location.href);
    if (stationId) {
      const station = stationById.get(stationId);
      if (station) setSelectedStation(station);
    }
  }, [stationById]);

  // The line filter has to branch on geometry: a station Point is visible when
  // any line it serves is active, whereas a segment LineString carries its own
  // `line` id and is visible when that one line is active. Testing every
  // feature against `visibleStationIds` (as this did before segments existed)
  // would drop every LineString, since a segment id is never a station id.
  const filteredGeoJson = useMemo(() => {
    const visibleStationIds = new Set(
      stations
        .filter((s) => s.validity.some((v) => activeLineIds.has(v.line)))
        .map((s) => s.id),
    );
    return {
      ...networkGeoJson,
      features: networkGeoJson.features.filter((f) =>
        f.geometry.type === "LineString"
          ? activeLineIds.has(f.properties?.line)
          : visibleStationIds.has(f.properties?.id),
      ),
    } as FeatureCollection<Point | LineString>;
  }, [activeLineIds, stations, networkGeoJson]);

  return (
    <>
      <NetworkMap
        networkGeoJson={filteredGeoJson}
        onStationClick={handleStationClick}
      />
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
      <StationSearch stations={stations} onSelect={handleSelectStation} />
      <StationPanel
        station={selectedStation}
        onClose={() => setSelectedStation(null)}
      />
    </>
  );
}

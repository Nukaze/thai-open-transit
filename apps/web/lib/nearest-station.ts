// apps/web/lib/nearest-station.ts

interface LatLon {
  lat: number;
  lon: number;
}

// IUGG mean Earth radius. A sphere is a ~0.3% approximation of the WGS84
// ellipsoid, which is far below GPS error at the sub-kilometre distances a
// "nearest station" lookup cares about, so Vincenty-grade accuracy is wasted.
const EARTH_RADIUS_M = 6371008.8;

const toRad = (deg: number): number => (deg * Math.PI) / 180;

export function haversineMeters(a: LatLon, b: LatLon): number {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  // Clamp: float error can push h marginally above 1 for antipodal points,
  // which would make asin return NaN.
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

// Generic over T so the math stays free of app types (e.g. StationWithStatus).
// Interchange stations appear once per line in the input; deduplicating them
// is the caller's job, not this function's.
export function nearestStations<
  T extends { coords: { geo: { lat: number; lon: number } } },
>(
  origin: LatLon,
  stations: readonly T[],
  limit = 1,
): { station: T; distanceMeters: number }[] {
  if (limit <= 0 || stations.length === 0) return [];

  // Linear scan on purpose: the network is a few hundred stations, so a
  // spatial index would cost more complexity than it saves.
  const scored = stations.map((station, index) => ({
    station,
    index,
    distanceMeters: haversineMeters(origin, station.coords.geo),
  }));

  // Explicit index tie-break keeps ordering deterministic regardless of the
  // engine's sort stability guarantees.
  scored.sort(
    (x, y) => x.distanceMeters - y.distanceMeters || x.index - y.index,
  );

  return scored
    .slice(0, limit)
    .map(({ station, distanceMeters }) => ({ station, distanceMeters }));
}

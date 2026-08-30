// packages/geo-utils/src/polyline.ts

/** [lon, lat], GeoJSON order (CLAUDE.md 6: WGS84 everywhere internally). */
export type Position = [number, number];

const EARTH_RADIUS_M = 6_371_008.8;
const DEG = Math.PI / 180;

/**
 * Equirectangular approximation, not full haversine. Over the tens of metres
 * to few kilometres this module deals with, at Bangkok's latitude, the error
 * is well under a centimetre - far below the precision of the underlying OSM
 * geometry - and it avoids trig per call in the simplifier's inner loop.
 */
export function distanceMeters(a: Position, b: Position): number {
  const x = (b[0] - a[0]) * DEG * Math.cos(((a[1] + b[1]) / 2) * DEG);
  const y = (b[1] - a[1]) * DEG;
  return EARTH_RADIUS_M * Math.hypot(x, y);
}

export function lineLengthMeters(line: Position[]): number {
  let total = 0;
  for (let i = 1; i < line.length; i++) {
    total += distanceMeters(line[i - 1]!, line[i]!);
  }
  return total;
}

/** Perpendicular distance from `point` to the segment `start`-`end`. */
function perpendicularDistanceMeters(
  point: Position,
  start: Position,
  end: Position,
): number {
  const scale = Math.cos(point[1] * DEG);
  const px = (point[0] - start[0]) * scale;
  const py = point[1] - start[1];
  const ex = (end[0] - start[0]) * scale;
  const ey = end[1] - start[1];

  const lengthSq = ex * ex + ey * ey;
  // Degenerate segment (start === end): fall back to point distance.
  const t =
    lengthSq === 0
      ? 0
      : Math.max(0, Math.min(1, (px * ex + py * ey) / lengthSq));
  const dx = px - t * ex;
  const dy = py - t * ey;
  return Math.hypot(dx, dy) * DEG * EARTH_RADIUS_M;
}

/**
 * Ramer-Douglas-Peucker, with the tolerance expressed in metres rather than
 * degrees so it means the same thing everywhere. Endpoints are always kept,
 * which matters here: a segment's first and last vertex are what join it to
 * its neighbours, and moving them would open gaps in the rendered network.
 */
export function simplifyLine(
  line: Position[],
  toleranceMeters: number,
): Position[] {
  if (line.length <= 2) return [...line];

  const first = line[0]!;
  const last = line[line.length - 1]!;

  let maxDistance = 0;
  let index = 0;
  for (let i = 1; i < line.length - 1; i++) {
    const distance = perpendicularDistanceMeters(line[i]!, first, last);
    if (distance > maxDistance) {
      maxDistance = distance;
      index = i;
    }
  }

  if (maxDistance <= toleranceMeters) return [first, last];

  const left = simplifyLine(line.slice(0, index + 1), toleranceMeters);
  const right = simplifyLine(line.slice(index), toleranceMeters);
  // `index` belongs to both halves; drop the duplicate join vertex.
  return [...left.slice(0, -1), ...right];
}

/**
 * Rounds to `decimals` places. Six decimals is ~0.11 m at the equator - finer
 * than the OSM survey it comes from, and it keeps the published GeoJSON from
 * carrying seventeen meaningless digits per ordinate.
 */
export function roundLine(line: Position[], decimals = 6): Position[] {
  const factor = 10 ** decimals;
  return line.map(([lon, lat]) => [
    Math.round(lon * factor) / factor,
    Math.round(lat * factor) / factor,
  ]);
}

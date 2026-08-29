import { describe, it, expect } from 'vitest';
import { toWgs84FromIndian1975Utm47N, fromWgs84ToIndian1975Utm47N } from './reproject';

describe('Indian 1975 UTM 47N <-> WGS84 reprojection', () => {
  it('round-trips within 1 meter tolerance', () => {
    // Approximate Bangkok city-center coordinates
    const originalLat = 13.7563;
    const originalLon = 100.5018;

    const { easting, northing } = fromWgs84ToIndian1975Utm47N(originalLat, originalLon);
    const { lat, lon } = toWgs84FromIndian1975Utm47N(easting, northing);

    // 1 meter is roughly 0.000009 degrees latitude at this latitude
    expect(Math.abs(lat - originalLat)).toBeLessThan(0.00001);
    expect(Math.abs(lon - originalLon)).toBeLessThan(0.00001);
  });
});

// apps/web/lib/nearest-station.test.ts
import { describe, it, expect } from "vitest";
import { haversineMeters, nearestStations } from "./nearest-station";

const st = (id: string, lat: number, lon: number) => ({
  id,
  coords: { geo: { lat, lon } },
});

describe("haversineMeters", () => {
  it("is zero for identical points", () => {
    const p = { lat: 13.7456, lon: 100.5341 };
    expect(haversineMeters(p, p)).toBe(0);
  });

  it("measures 1 degree of latitude as ~111,195 m", () => {
    const d = haversineMeters({ lat: 13, lon: 100 }, { lat: 14, lon: 100 });
    expect(Math.abs(d - 111195)).toBeLessThan(1);
  });

  it("measures Siam to Chit Lom at ~976 m", () => {
    const d = haversineMeters(
      { lat: 13.7456, lon: 100.5341 },
      { lat: 13.7441, lon: 100.543 },
    );
    expect(d).toBeGreaterThan(960);
    expect(d).toBeLessThan(990);
  });

  it("is symmetric", () => {
    const a = { lat: 13.7456, lon: 100.5341 };
    const b = { lat: 13.8021, lon: 100.5536 };
    expect(haversineMeters(a, b)).toBeCloseTo(haversineMeters(b, a), 9);
  });
});

describe("nearestStations", () => {
  const origin = { lat: 13.7456, lon: 100.5341 };
  const far = st("far", 13.8, 100.55);
  const near = st("near", 13.7457, 100.5342);
  const mid = st("mid", 13.75, 100.54);

  it("returns the closest station first by default", () => {
    const [first, ...rest] = nearestStations(origin, [far, near, mid]);
    expect(first?.station.id).toBe("near");
    expect(rest).toEqual([]);
  });

  it("sorts ascending and respects limit", () => {
    const res = nearestStations(origin, [far, near, mid], 2);
    expect(res.map((r) => r.station.id)).toEqual(["near", "mid"]);
    expect(res[0]!.distanceMeters).toBeLessThan(res[1]!.distanceMeters);
  });

  it("returns [] for empty input", () => {
    expect(nearestStations(origin, [])).toEqual([]);
  });

  it("returns [] when limit is 0 or negative", () => {
    expect(nearestStations(origin, [near], 0)).toEqual([]);
    expect(nearestStations(origin, [near], -1)).toEqual([]);
  });

  it("keeps input order on distance ties", () => {
    const a = st("a", 13.75, 100.54);
    const b = st("b", 13.75, 100.54);
    const c = st("c", 13.75, 100.54);
    const res = nearestStations(origin, [a, b, c], 3);
    expect(res.map((r) => r.station.id)).toEqual(["a", "b", "c"]);
  });
});

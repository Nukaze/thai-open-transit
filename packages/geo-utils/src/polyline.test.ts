import { describe, it, expect } from "vitest";
import {
  distanceMeters,
  lineLengthMeters,
  simplifyLine,
  roundLine,
  type Position,
} from "./polyline";

// Siam and Ratchadamri, ~800 m apart on the Silom Line.
const SIAM: Position = [100.534219, 13.745621];
const RATCHADAMRI: Position = [100.539449, 13.739469];

describe("distanceMeters", () => {
  it("measures a known short distance to within a metre", () => {
    const d = distanceMeters(SIAM, RATCHADAMRI);
    expect(d).toBeGreaterThan(850);
    expect(d).toBeLessThan(920);
  });

  it("is zero for identical points", () => {
    expect(distanceMeters(SIAM, SIAM)).toBe(0);
  });
});

describe("simplifyLine", () => {
  it("collapses collinear intermediate vertices", () => {
    const straight: Position[] = [
      [100.5, 13.7],
      [100.51, 13.7],
      [100.52, 13.7],
      [100.53, 13.7],
    ];
    expect(simplifyLine(straight, 1)).toEqual([
      [100.5, 13.7],
      [100.53, 13.7],
    ]);
  });

  it("keeps a vertex whose deviation exceeds the tolerance", () => {
    // ~110 m off the chord, well beyond a 5 m tolerance.
    const bent: Position[] = [
      [100.5, 13.7],
      [100.51, 13.701],
      [100.52, 13.7],
    ];
    expect(simplifyLine(bent, 5)).toHaveLength(3);
  });

  // Endpoints join a segment to its neighbours; moving them opens visible
  // gaps in the rendered network.
  it("never moves the endpoints", () => {
    const line: Position[] = [
      [100.5, 13.7],
      [100.5001, 13.70001],
      [100.5002, 13.70002],
      [100.53, 13.73],
    ];
    const simplified = simplifyLine(line, 50);
    expect(simplified[0]).toEqual(line[0]);
    expect(simplified.at(-1)).toEqual(line.at(-1));
  });

  it("returns short lines unchanged", () => {
    const line: Position[] = [
      [100.5, 13.7],
      [100.6, 13.8],
    ];
    expect(simplifyLine(line, 100)).toEqual(line);
  });
});

describe("lineLengthMeters", () => {
  it("sums the leg distances", () => {
    const line: Position[] = [SIAM, RATCHADAMRI, SIAM];
    expect(lineLengthMeters(line)).toBeCloseTo(
      distanceMeters(SIAM, RATCHADAMRI) * 2,
      6,
    );
  });
});

describe("roundLine", () => {
  it("rounds to six decimals by default", () => {
    expect(roundLine([[100.123456789, 13.987654321]])).toEqual([
      [100.123457, 13.987654],
    ]);
  });
});

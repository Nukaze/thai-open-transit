import { describe, it, expect } from "vitest";
import { isWithinBangkokRegion } from "./validate";

describe("isWithinBangkokRegion", () => {
  it("accepts coordinates within Bangkok metro region (BKK/Nonthaburi/Samut Prakan/Pathum Thani)", () => {
    expect(isWithinBangkokRegion(13.7563, 100.5018)).toBe(true); // central Bangkok
  });

  it("rejects coordinates far outside the region", () => {
    expect(isWithinBangkokRegion(18.7883, 98.9853)).toBe(false); // Chiang Mai
  });
});

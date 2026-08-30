import { describe, it, expect } from "vitest";
import { buildOverpassQuery } from "./overpass-query";

describe("buildOverpassQuery", () => {
  it("builds a query scoped to the given bbox targeting rail route relations", () => {
    const query = buildOverpassQuery([13.4, 100.2, 14.2, 100.95]);
    expect(query).toContain("[bbox:13.4,100.2,14.2,100.95]");
    expect(query).toContain('route~"light_rail|subway|monorail"');
  });

  // Regression: the first version ended with `out skel qt`, which strips tags
  // from the recursed members. The extract then had station coordinates but no
  // names, no `name:en` and no `ref` station codes - unusable for building
  // entities.
  it("emits member tags so station names and codes survive the import", () => {
    const query = buildOverpassQuery([13.4, 100.2, 14.2, 100.95]);
    expect(query).toContain("out body qt");
    expect(query).not.toContain("out skel");
  });
});

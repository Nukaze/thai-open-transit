import { describe, it, expect } from "vitest";
import {
  buildOverpassQuery,
  buildTrainQuery,
  URBAN_TRAIN_NETWORKS,
} from "./overpass-query";

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

describe("buildTrainQuery", () => {
  const query = buildTrainQuery([13.4, 100.2, 14.2, 100.95]);

  it("selects urban rail route=train relations by network, not by route alone", () => {
    expect(query).toContain("[bbox:13.4,100.2,14.2,100.95]");
    expect(query).toContain('[route="train"]');
    expect(query).toContain('[network~"^(รถไฟฟ้าชานเมือง สายสีแดง|ARL)$"]');
  });

  // A bare route=train filter would pull in the Bangkok Connex 9001-9006 and
  // SRT Mahachai/Thonburi commuter relations, which are out of scope.
  it("does not match long-distance or commuter SRT networks", () => {
    const pattern = new RegExp(/\[network~"([^"]+)"\]/.exec(query)![1]!);
    for (const network of URBAN_TRAIN_NETWORKS) {
      expect(pattern.test(network)).toBe(true);
    }
    expect(pattern.test("Bangkok Connex")).toBe(false);
    expect(pattern.test("การรถไฟแห่งประเทศไทย")).toBe(false);
    expect(pattern.test("ARLX")).toBe(false);
  });

  it("emits member tags like the main query", () => {
    expect(query).toContain("out body qt");
    expect(query).not.toContain("out skel");
  });
});

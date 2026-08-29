import { describe, it, expect } from "vitest";
import { LayoutSchema } from "./layout";

describe("LayoutSchema", () => {
  it("accepts a valid layout set", () => {
    const layout = {
      era: "2026",
      stations: [{ station_id: "BL15", x: 420, y: 180 }],
    };
    expect(LayoutSchema.safeParse(layout).success).toBe(true);
  });
});

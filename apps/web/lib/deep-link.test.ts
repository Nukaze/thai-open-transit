// apps/web/lib/deep-link.test.ts
import { describe, it, expect } from "vitest";
import { getStationIdFromUrl, buildStationDeepLink } from "./deep-link";

describe("deep links", () => {
  it("extracts a station id from a URL with ?station=", () => {
    expect(getStationIdFromUrl("https://example.com/?station=BL15")).toBe(
      "BL15",
    );
  });

  it("returns null when there is no station param", () => {
    expect(getStationIdFromUrl("https://example.com/")).toBeNull();
  });

  it("builds a relative deep link for a station id", () => {
    expect(buildStationDeepLink("BL15")).toBe("?station=BL15");
  });
});

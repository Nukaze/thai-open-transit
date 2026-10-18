import { describe, expect, it } from "vitest";
import { commitUrl, dataDateIso, formatDataDate } from "./buildInfo";

describe("commitUrl", () => {
  it("links a short or full hash to the commit on GitHub", () => {
    expect(commitUrl("a1b2c3d")).toBe(
      "https://github.com/Nukaze/thai-open-transit/commit/a1b2c3d",
    );
  });

  it("does not link a dev build or junk", () => {
    expect(commitUrl("dev")).toBeNull();
    expect(commitUrl("abc")).toBeNull();
  });
});

describe("formatDataDate", () => {
  // 2026-10-13T20:00Z is already 14 Oct in Bangkok (UTC+7).
  it("shows the Bangkok calendar day", () => {
    expect(formatDataDate("2026-10-13T20:00:00Z", "en")).toBe("14 Oct 2026");
  });

  it("uses the Buddhist year in Thai", () => {
    expect(formatDataDate("2026-10-13T11:20:07.695Z", "th")).toBe(
      "13 ต.ค. 2569",
    );
  });

  it("is null for a missing or invalid date", () => {
    expect(formatDataDate("", "en")).toBeNull();
    expect(formatDataDate("not a date", "en")).toBeNull();
  });
});

describe("dataDateIso", () => {
  it("gives the Bangkok day as YYYY-MM-DD", () => {
    expect(dataDateIso("2026-10-13T20:00:00Z")).toBe("2026-10-14");
  });
});

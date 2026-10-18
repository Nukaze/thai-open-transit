// apps/web/lib/visitCounter.test.ts
import { describe, it, expect } from "vitest";
import { bangkokDay, parseStats, shouldRecord } from "./visitCounter";

describe("bangkokDay", () => {
  it("is already the next day in Bangkok at 17:00 UTC", () => {
    // UTC+7: 2026-10-18T17:00Z is 2026-10-19 00:00 in Bangkok.
    expect(bangkokDay(new Date("2026-10-18T17:00:00Z"))).toBe("2026-10-19");
  });

  it("is still the same day just before Bangkok midnight", () => {
    expect(bangkokDay(new Date("2026-10-18T16:59:59Z"))).toBe("2026-10-18");
  });
});

describe("shouldRecord", () => {
  it("counts a browser never counted before", () => {
    expect(shouldRecord(null, "2026-10-18")).toBe(true);
  });

  it("does not count a second visit the same day", () => {
    expect(shouldRecord("2026-10-18", "2026-10-18")).toBe(false);
  });

  it("counts again on a new day", () => {
    expect(shouldRecord("2026-10-17", "2026-10-18")).toBe(true);
  });
});

describe("parseStats", () => {
  it("reads the single row an RPC table returns", () => {
    expect(parseStats([{ total: 1234, today: 5 }])).toEqual({
      total: 1234,
      today: 5,
    });
  });

  it("rejects anything else", () => {
    expect(parseStats([])).toBeNull();
    expect(parseStats({ total: 1, today: 1 })).toBeNull();
    expect(parseStats([{ total: "1", today: 1 }])).toBeNull();
    expect(parseStats(null)).toBeNull();
  });
});

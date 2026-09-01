// apps/web/lib/asOf.test.ts
import { describe, it, expect } from "vitest";
import { isValidAt } from "./asOf";

describe("isValidAt", () => {
  it("is false before the window opens", () => {
    expect(isValidAt({ from: "2019-01-01", to: null }, "2018-12-31")).toBe(
      false,
    );
  });

  it("is true on the opening date (from is inclusive)", () => {
    expect(isValidAt({ from: "2019-01-01", to: null }, "2019-01-01")).toBe(
      true,
    );
  });

  it("is true for an open-ended window on any later date", () => {
    expect(isValidAt({ from: "2019-01-01", to: null }, "2026-09-01")).toBe(
      true,
    );
  });

  it("is true the day before the window closes", () => {
    expect(
      isValidAt({ from: "2019-01-01", to: "2020-01-01" }, "2019-12-31"),
    ).toBe(true);
  });

  it("is false on the closing date (to is exclusive)", () => {
    expect(
      isValidAt({ from: "2019-01-01", to: "2020-01-01" }, "2020-01-01"),
    ).toBe(false);
  });
});

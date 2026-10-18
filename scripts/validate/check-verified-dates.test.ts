import { describe, expect, it } from "vitest";
import type { Station, Line, Segment } from "schema";
import { checkVerifiedDates } from "./check-verified-dates";

const station = (id: string, last_verified_at: string) =>
  ({ id, last_verified_at }) as unknown as Station;

const network = (...stations: Station[]) => ({
  stations,
  lines: [] as Line[],
  segments: [] as Segment[],
});

describe("checkVerifiedDates", () => {
  it("passes past dates, today and tomorrow (UTC vs Bangkok slack)", () => {
    expect(
      checkVerifiedDates(
        network(
          station("A", "2026-10-06"),
          station("B", "2026-10-19"),
          station("C", "2026-10-20"),
        ),
        "2026-10-19",
      ),
    ).toEqual([]);
  });

  it("rejects a date further in the future", () => {
    expect(
      checkVerifiedDates(network(station("BL15", "2062-10-06")), "2026-10-19"),
    ).toEqual(["BL15: last_verified_at 2062-10-06 is in the future"]);
  });

  it("hints at a Buddhist-era year", () => {
    expect(
      checkVerifiedDates(network(station("BL15", "2569-10-06")), "2026-10-19"),
    ).toEqual([
      "BL15: last_verified_at 2569-10-06 is in the future - looks like a Buddhist-era year; use AD (2026-10-06)",
    ]);
  });
});

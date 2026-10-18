import { describe, expect, it } from "vitest";
import { findUnbumped } from "./check-verification-bumped";

describe("findUnbumped", () => {
  it("warns when a source entity changes without a new date", () => {
    expect(
      findUnbumped([
        {
          path: "data/source/stations/BL15.json",
          before: {
            id: "BL15",
            name_en: "Lat Phrao",
            last_verified_at: "2026-09-01",
          },
          after: {
            id: "BL15",
            name_en: "Lat Phrao!",
            last_verified_at: "2026-09-01",
          },
        },
      ]),
    ).toEqual([
      "data/source/stations/BL15.json: data changed but last_verified_at is still 2026-09-01",
    ]);
  });

  it("is quiet when the date was bumped, or the file is new or deleted", () => {
    expect(
      findUnbumped([
        {
          path: "data/source/lines/MRT_BLUE.json",
          before: { id: "MRT_BLUE", last_verified_at: "2026-09-01" },
          after: { id: "MRT_BLUE", x: 1, last_verified_at: "2026-10-06" },
        },
        {
          path: "data/source/segments/A1__A2.json",
          before: null,
          after: { id: "A1__A2", last_verified_at: "2026-10-06" },
        },
        {
          path: "data/source/stations/X1.json",
          before: { id: "X1" },
          after: null,
        },
      ]),
    ).toEqual([]);
  });

  it("warns when an override changes without setting or bumping a date", () => {
    expect(
      findUnbumped([
        {
          path: "data/overrides/BL15.json",
          before: null,
          after: { id: "BL15", interchange_group: "LAT_PHRAO" },
        },
        {
          path: "data/overrides/N8.json",
          before: {
            id: "N8",
            structure: "elevated",
            last_verified_at: "2026-10-06",
          },
          after: {
            id: "N8",
            structure: "underground",
            last_verified_at: "2026-10-06",
          },
        },
      ]),
    ).toEqual([
      "data/overrides/BL15.json: override changes the data but sets no last_verified_at",
      "data/overrides/N8.json: override changed but last_verified_at is still 2026-10-06",
    ]);
  });

  it("ignores files outside the data directories", () => {
    expect(
      findUnbumped([
        { path: "data/source/osm-raw.json", before: { a: 1 }, after: { a: 2 } },
      ]),
    ).toEqual([]);
  });
});

import { describe, it, expect } from "vitest";
import { stationsToCsv } from "./to-csv";
import type { Station } from "schema";

describe("stationsToCsv", () => {
  it("produces a header row plus one row per station", () => {
    const stations = [
      {
        id: "BL15",
        name_th: "ลาดพร้าว",
        name_en: "Lat Phrao",
        structure: "underground",
        accessible: true,
        coords: { geo: { lat: 13.8163, lon: 100.5615 } },
      } as Station,
    ];
    const csv = stationsToCsv(stations);
    const lines = csv.trim().split("\n");
    expect(lines[0]).toBe("id,name_th,name_en,structure,accessible,lat,lon");
    expect(lines[1]).toBe(
      "BL15,ลาดพร้าว,Lat Phrao,underground,true,13.8163,100.5615",
    );
  });

  it("quotes fields containing commas", () => {
    const stations = [
      {
        id: "X1",
        name_th: "a",
        name_en: "Name, with comma",
        structure: "elevated",
        accessible: false,
        coords: { geo: { lat: 1, lon: 2 } },
      } as Station,
    ];
    const csv = stationsToCsv(stations);
    expect(csv).toContain('"Name, with comma"');
  });
});

import type { Station } from "schema";

const HEADER = [
  "id",
  "name_th",
  "name_en",
  "structure",
  "accessible",
  "lat",
  "lon",
];

function csvField(value: string | number | boolean): string {
  const str = String(value);
  return str.includes(",") || str.includes('"')
    ? `"${str.replace(/"/g, '""')}"`
    : str;
}

export function stationsToCsv(stations: Station[]): string {
  const rows = stations.map((s) =>
    [
      s.id,
      s.name_th,
      s.name_en ?? "",
      s.structure,
      s.accessible,
      s.coords.geo.lat,
      s.coords.geo.lon,
    ]
      .map(csvField)
      .join(","),
  );
  return [HEADER.join(","), ...rows].join("\n") + "\n";
}

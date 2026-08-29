import { writeFileSync, mkdirSync } from "node:fs";
import { buildOverpassQuery } from "./overpass-query";

const BANGKOK_REGION_BBOX: [number, number, number, number] = [
  13.4, 100.2, 14.2, 100.95,
];
const OVERPASS_ENDPOINT = "https://overpass-api.de/api/interpreter";

async function main() {
  const query = buildOverpassQuery(BANGKOK_REGION_BBOX);
  const response = await fetch(OVERPASS_ENDPOINT, {
    method: "POST",
    body: `data=${encodeURIComponent(query)}`,
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent":
        "BangkokOpenTransit/1.0 (+https://github.com/opentransit-th/bangkok-open-transit)",
    },
  });
  if (!response.ok) {
    throw new Error(
      `Overpass API request failed: ${response.status} ${response.statusText}`,
    );
  }
  const data = await response.json();
  mkdirSync(new URL("../../data/source/", import.meta.url), {
    recursive: true,
  });
  writeFileSync(
    new URL("../../data/source/osm-raw.json", import.meta.url),
    JSON.stringify(data, null, 2),
  );
  console.log(
    `Wrote ${data.elements?.length ?? 0} OSM elements to data/source/osm-raw.json`,
  );
}

if (import.meta.main) {
  await main();
}

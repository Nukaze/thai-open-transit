import { writeFileSync, mkdirSync } from "node:fs";
import { buildOverpassQuery, buildTrainQuery } from "./overpass-query";

const BANGKOK_REGION_BBOX: [number, number, number, number] = [
  13.4, 100.2, 14.2, 100.95,
];
const OVERPASS_ENDPOINT = "https://overpass-api.de/api/interpreter";

/**
 * `--train` imports the SRT Red Lines and Airport Rail Link into a separate
 * file. osm-raw.json feeds every existing seed, so re-importing it would hand
 * current OSM geometry to lines already published; the train extract is
 * additive instead.
 */
const TRAIN_MODE = process.argv.includes("--train");

async function main() {
  const query = TRAIN_MODE
    ? buildTrainQuery(BANGKOK_REGION_BBOX)
    : buildOverpassQuery(BANGKOK_REGION_BBOX);
  const outName = TRAIN_MODE ? "osm-raw-train.json" : "osm-raw.json";
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
    new URL(`../../data/source/${outName}`, import.meta.url),
    JSON.stringify(data, null, 2),
  );
  console.log(
    `Wrote ${data.elements?.length ?? 0} OSM elements to data/source/${outName}`,
  );
}

if (import.meta.main) {
  await main();
}

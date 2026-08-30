import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { StationSchema, LineSchema, SegmentSchema } from "schema";
import { assembleNetwork } from "./assemble";
import { stationsToCsv } from "./to-csv";

function readEntities<T>(dir: URL, parse: (raw: unknown) => T): T[] {
  let files: string[] = [];
  try {
    files = readdirSync(dir).filter((f) => f.endsWith(".json"));
  } catch {
    return [];
  }
  return files.map((file) =>
    parse(JSON.parse(readFileSync(new URL(file, dir), "utf-8"))),
  );
}

function main() {
  const sourceDir = new URL("../../data/source/", import.meta.url);
  const overridesDir = new URL("../../data/overrides/", import.meta.url);
  const distDir = new URL("../../data/dist/", import.meta.url);

  const stations = readEntities(new URL("stations/", sourceDir), (raw) =>
    StationSchema.parse(raw),
  );
  const lines = readEntities(new URL("lines/", sourceDir), (raw) =>
    LineSchema.parse(raw),
  );
  const segments = readEntities(new URL("segments/", sourceDir), (raw) =>
    SegmentSchema.parse(raw),
  );

  // data/overrides applies corrections by station/line/segment id; each
  // override file's content replaces the matching source entity's fields.
  const overrides = readEntities(
    new URL("./", overridesDir),
    (raw) => raw as { id: string } & Record<string, unknown>,
  );
  const overrideById = new Map(overrides.map((o) => [o.id, o]));
  const applyOverrides = <T extends { id: string }>(entities: T[]): T[] =>
    entities.map((entity) => ({
      ...entity,
      ...(overrideById.get(entity.id) ?? {}),
    }));

  const { network, geojson } = assembleNetwork(
    applyOverrides(stations),
    applyOverrides(lines),
    applyOverrides(segments),
  );

  mkdirSync(distDir, { recursive: true });
  writeFileSync(new URL("network.json", distDir), JSON.stringify(network));
  writeFileSync(new URL("network.geojson", distDir), JSON.stringify(geojson));
  writeFileSync(
    new URL("stations.csv", distDir),
    stationsToCsv(applyOverrides(stations)),
  );
  console.log(
    `Wrote data/dist/network.json (${stations.length} stations, ${lines.length} lines, ${segments.length} segments)`,
  );
}

main();

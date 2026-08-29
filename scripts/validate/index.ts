import { readFileSync, statSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { StationSchema, LineSchema, SegmentSchema } from "schema";
import {
  buildGraph,
  findOrphanStations,
  findDanglingSegments,
} from "network-graph";
import { checkSourceRefs } from "./check-source-refs";

const NETWORK_JSON_BROTLI_BUDGET_BYTES = 120 * 1024;

function main() {
  const networkPath = new URL("../../data/dist/network.json", import.meta.url);
  const raw = JSON.parse(readFileSync(networkPath, "utf-8"));

  const stations = raw.stations.map((s: unknown) => StationSchema.parse(s));
  const lines = raw.lines.map((l: unknown) => LineSchema.parse(l));
  const segments = raw.segments.map((s: unknown) => SegmentSchema.parse(s));

  const graph = buildGraph(stations, segments);
  const orphans = findOrphanStations(graph);
  const dangling = findDanglingSegments(graph);
  const sourceRefViolations = checkSourceRefs({ stations, lines, segments });

  const errors = [
    ...orphans.map((id) => `Orphan station: ${id}`),
    ...dangling.map((id) => `Dangling segment: ${id}`),
    ...sourceRefViolations,
  ];

  // gzip is a close, dependency-free proxy for brotli size for this budget
  // check; CI's actual deploy step still measures real brotli output.
  const compressedSize = gzipSync(readFileSync(networkPath)).byteLength;
  if (compressedSize > NETWORK_JSON_BROTLI_BUDGET_BYTES) {
    errors.push(
      `network.json compressed size ${compressedSize} bytes exceeds ${NETWORK_JSON_BROTLI_BUDGET_BYTES} byte budget`,
    );
  }

  if (errors.length > 0) {
    console.error(
      "Validation failed:\n" + errors.map((e) => `  - ${e}`).join("\n"),
    );
    process.exit(1);
  }
  console.log("Validation passed.");
}

main();

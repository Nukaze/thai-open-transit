import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { StationSchema, LineSchema, SegmentSchema } from "schema";
import {
  buildGraph,
  findOrphanStations,
  findDanglingSegments,
} from "network-graph";
import { checkSourceRefs } from "./check-source-refs";
import { checkVerifiedDates } from "./check-verified-dates";

const NETWORK_JSON_BROTLI_BUDGET_BYTES = 120 * 1024;

// `JSON.parse` returns `any`, so reaching straight for `raw.stations.map(...)`
// is an unchecked `any` access - forbidden by CLAUDE.md 6 - and would fail
// with a TypeError rather than a validation message if network.json were
// malformed. This narrows the top-level shape first, so a bad artifact is
// reported as a validation failure like every other problem in this file.
function parseNetworkFile(json: string): {
  stations: unknown[];
  lines: unknown[];
  segments: unknown[];
} {
  const raw: unknown = JSON.parse(json);
  if (typeof raw !== "object" || raw === null) {
    throw new Error("network.json is not a JSON object");
  }
  const record = raw as Record<string, unknown>;
  for (const key of ["stations", "lines", "segments"] as const) {
    if (!Array.isArray(record[key])) {
      throw new Error(`network.json is missing an array property "${key}"`);
    }
  }
  return {
    stations: record.stations as unknown[],
    lines: record.lines as unknown[],
    segments: record.segments as unknown[],
  };
}

function main() {
  const networkPath = new URL("../../data/dist/network.json", import.meta.url);
  const raw = parseNetworkFile(readFileSync(networkPath, "utf-8"));

  const stations = raw.stations.map((s) => StationSchema.parse(s));
  const lines = raw.lines.map((l) => LineSchema.parse(l));
  const segments = raw.segments.map((s) => SegmentSchema.parse(s));

  const graph = buildGraph(stations, segments);
  const orphans = findOrphanStations(graph);
  const dangling = findDanglingSegments(graph);
  const sourceRefViolations = checkSourceRefs({ stations, lines, segments });
  const verifiedDateViolations = checkVerifiedDates(
    { stations, lines, segments },
    new Date().toISOString().slice(0, 10),
  );

  const errors = [
    ...orphans.map((id) => `Orphan station: ${id}`),
    ...dangling.map((id) => `Dangling segment: ${id}`),
    ...sourceRefViolations,
    ...verifiedDateViolations,
  ];

  // An empty network passes every other check here vacuously - no orphans, no
  // dangling segments, no missing source_refs, trivially under the size budget
  // - so an accidental data wipe would ship a blank map with CI green. This
  // defaults to strict; CI opts out explicitly while data population is still
  // a separate workstream, so removing that env var later restores the guard
  // rather than requiring anyone to remember to add it.
  if (stations.length === 0 && process.env.ALLOW_EMPTY !== "1") {
    errors.push(
      "Network has zero stations - set ALLOW_EMPTY=1 to permit this intentionally (e.g. before data population)",
    );
  }

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

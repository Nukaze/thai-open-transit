// apps/web/scripts/build-basemap.ts
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * Extracts a Bangkok-region PMTiles basemap from Protomaps' hosted build
 * server, using the pmtiles CLI's remote-extract feature (avoids
 * downloading the full planet build). Run manually once; the output is
 * committed to the repo (apps/web/public/basemap/bangkok.pmtiles) rather
 * than regenerated in CI, per this plan's "commit to repo" hosting decision.
 *
 * Requires the `pmtiles` CLI (https://github.com/protomaps/go-pmtiles) on
 * PATH - install separately, not a project dependency, since it is a build
 * tool invoked once, not at every build.
 */
async function main() {
  const outDir = new URL("../public/basemap/", import.meta.url);
  mkdirSync(outDir, { recursive: true });

  // Bangkok metro region bbox: lon_min,lat_min,lon_max,lat_max
  const bbox = "100.2,13.4,100.95,14.2";
  const remoteSource = "https://build.protomaps.com/20260829.pmtiles"; // latest daily build at extraction time (2026-08-30) - update date when re-running
  // .pathname yields a leading-slash form (e.g. /C:/...) that the go-pmtiles
  // binary cannot open on Windows; fileURLToPath produces a native path on
  // every platform.
  const outputPath = fileURLToPath(new URL("bangkok.pmtiles", outDir));

  const proc = Bun.spawn(
    [
      "pmtiles",
      "extract",
      remoteSource,
      outputPath,
      `--bbox=${bbox}`,
      "--maxzoom=15",
    ],
    { stdout: "inherit", stderr: "inherit" },
  );
  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    throw new Error(`pmtiles extract failed with exit code ${exitCode}`);
  }
  console.log(`Wrote ${outputPath}`);
}

if (import.meta.main) {
  await main();
}

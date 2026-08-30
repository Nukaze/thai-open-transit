// apps/web/scripts/copy-maplibre-worker.ts
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Copies MapLibre's web worker bundle (and the sibling module it imports at
 * runtime) into public/maplibre/, so `setWorkerUrl` in components/Map.tsx can
 * point at a plain static path.
 *
 * Why this exists: maplibre-gl v6 is ESM-only and constructs its worker from
 * `new URL('./maplibre-gl-worker.mjs', import.meta.url)`. Next.js is called
 * out by MapLibre's own docs as the exception where that does not work - the
 * bundler emits the worker file without `maplibre-gl-shared.mjs` next to it,
 * the worker throws on its first import, and the failure is silent: the map
 * mounts, the style loads, and then every tile request sits unanswered
 * forever. Symptom is a blank basemap with an empty console.
 *
 * Both files must land in the SAME directory - the worker imports its sibling
 * by relative path.
 */
const WORKER_FILES = ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"];

function main() {
  // Resolved through the module graph rather than a hardcoded
  // ../../node_modules path: this is a Bun workspace, so maplibre-gl may be
  // hoisted to the repo root or linked under apps/web/node_modules.
  const distDir = dirname(
    fileURLToPath(import.meta.resolve("maplibre-gl/dist/maplibre-gl.mjs")),
  );
  const outDir = fileURLToPath(new URL("../public/maplibre/", import.meta.url));
  mkdirSync(outDir, { recursive: true });

  for (const file of WORKER_FILES) {
    copyFileSync(join(distDir, file), join(outDir, file));
  }
  console.log(`Copied ${WORKER_FILES.join(", ")} to public/maplibre/`);
}

main();

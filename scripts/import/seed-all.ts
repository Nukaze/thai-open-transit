// scripts/import/seed-all.ts
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

/**
 * Runs every seed script in dependency order. Order matters: seed-2019 rewrites
 * entities first written by seed-1999, so running seed-1999 alone after
 * seed-2019 silently reverts data. Each seed runs in its own process because
 * the scripts execute main() at import time.
 */
const SEEDS = [
  "seed-1999.ts",
  "seed-2019.ts",
  "seed-red-arl.ts",
  "seed-new-lines-2020-2025.ts",
];

for (const seed of SEEDS) {
  console.log(`\n=== ${seed} ===`);
  const result = spawnSync(
    process.execPath,
    [fileURLToPath(new URL(seed, import.meta.url))],
    { stdio: "inherit" },
  );
  if (result.status !== 0) {
    console.error(`${seed} failed (exit ${result.status ?? "signal"})`);
    process.exit(result.status ?? 1);
  }
}

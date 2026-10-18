// Warns when a data file changes but its `last_verified_at` does not, so the
// web footer's "Data verified" date (the newest last_verified_at) does not
// silently go stale. A warning, not a failure: a typo fix or a formatting
// change does not mean the record was re-verified.
//
// Usage (CI, on pull requests): bun run check-verification-bumped.ts [base]
// `base` defaults to HEAD^1, the base-branch tip of a PR merge commit.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

export interface DataFileChange {
  path: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
}

const ENTITY_DIRS = [
  "data/source/stations/",
  "data/source/lines/",
  "data/source/segments/",
];
const OVERRIDES_DIR = "data/overrides/";

export function findUnbumped(changes: DataFileChange[]): string[] {
  const warnings: string[] = [];
  for (const { path, before, after } of changes) {
    if (!after) continue; // deleted
    if (JSON.stringify(before) === JSON.stringify(after)) continue;
    const beforeDate = before?.last_verified_at;
    const afterDate = after.last_verified_at;

    if (path.startsWith(OVERRIDES_DIR)) {
      if (afterDate === undefined) {
        warnings.push(
          `${path}: override changes the data but sets no last_verified_at`,
        );
      } else if (before && beforeDate === afterDate) {
        warnings.push(
          `${path}: override changed but last_verified_at is still ${String(afterDate)}`,
        );
      }
    } else if (ENTITY_DIRS.some((dir) => path.startsWith(dir))) {
      // A new file must carry a date already (the schema requires one).
      if (before && beforeDate === afterDate) {
        warnings.push(
          `${path}: data changed but last_verified_at is still ${String(afterDate)}`,
        );
      }
    }
  }
  return warnings;
}

function git(...args: string[]): string {
  return execFileSync("git", args, { stdio: "pipe" }).toString();
}

function parse(json: string): Record<string, unknown> | null {
  try {
    const value: unknown = JSON.parse(json);
    return typeof value === "object" && value !== null
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function main() {
  const base = process.argv[2] ?? "HEAD^1";
  const paths = git(
    "diff",
    "--name-only",
    base,
    "HEAD",
    "--",
    ...ENTITY_DIRS,
    OVERRIDES_DIR,
  )
    .split("\n")
    .filter((p) => p.endsWith(".json"));

  const changes: DataFileChange[] = paths.map((path) => {
    let before: Record<string, unknown> | null = null;
    try {
      before = parse(git("show", `${base}:${path}`));
    } catch {
      // New in this change.
    }
    const after = existsSync(path) ? parse(readFileSync(path, "utf-8")) : null;
    return { path, before, after };
  });

  const warnings = findUnbumped(changes);
  for (const warning of warnings) {
    const file = warning.slice(0, warning.indexOf(":"));
    console.log(
      process.env.GITHUB_ACTIONS
        ? `::warning file=${file}::${warning}`
        : `warning: ${warning}`,
    );
  }
  console.log(
    `Checked ${changes.length} changed data file(s), ${warnings.length} without a last_verified_at bump.`,
  );
}

if (import.meta.main) main();

// apps/web/next.config.ts
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { NextConfig } from "next";

// The commit this build comes from, read at build time and never written to
// the repo (a committed hash would need a new commit, and so on forever).
// The host's own variable first, then local git, then "dev": no environment
// variable is required to build (CLAUDE.md 3).
function buildCommit(): string {
  const fromHost =
    process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.CF_PAGES_COMMIT_SHA;
  if (fromHost) return fromHost.slice(0, 7);
  try {
    return execFileSync("git", ["rev-parse", "--short=7", "HEAD"], {
      stdio: "pipe",
    })
      .toString()
      .trim();
  } catch {
    return "dev";
  }
}

// The newest `last_verified_at` across stations and lines: when the data was
// last checked against its sources. Not network.json's `generated_at`, which
// is stamped on every build and would only repeat the deploy date. Same path
// page.tsx reads from.
function dataVerifiedAt(): string {
  try {
    const network = JSON.parse(
      readFileSync(
        join(process.cwd(), "../../data/dist/network.json"),
        "utf-8",
      ),
    ) as Record<string, unknown>;
    const dates = ["stations", "lines"].flatMap((key) => {
      const items = network[key];
      return Array.isArray(items)
        ? items
            .map(
              (item) =>
                (item as { last_verified_at?: unknown }).last_verified_at,
            )
            .filter((d): d is string => typeof d === "string")
        : [];
    });
    return dates.sort().at(-1) ?? "";
  } catch {
    return "";
  }
}

const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  agentRules: false,
  trailingSlash: true,
  // Every screen corner is taken by map UI (panel or credits, theme button,
  // controls), so the dev-only "N" badge always lands on something - it sat
  // on the credits and made them look blocked. Build and runtime errors
  // still surface with it off (Next.js devIndicators docs).
  devIndicators: false,
  // Inlined into the bundle at build time (lib/buildInfo.ts reads them).
  env: {
    NEXT_PUBLIC_BUILD_COMMIT: buildCommit(),
    NEXT_PUBLIC_DATA_VERIFIED_AT: dataVerifiedAt(),
  },
};

export default nextConfig;

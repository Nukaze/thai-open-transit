// apps/web/lib/buildInfo.ts
//
// What this deployment is built from: the commit and when the data was last
// verified, both stamped in at build time by next.config.ts.

import type { Lang } from "./i18n";

export const GITHUB_REPO_URL = "https://github.com/Nukaze/thai-open-transit";

/** Short commit hash, or "dev" when the build had no git. */
export const BUILD_COMMIT = process.env.NEXT_PUBLIC_BUILD_COMMIT || "dev";

/** Newest `last_verified_at` in the dataset (YYYY-MM-DD), or "". */
export const DATA_VERIFIED_AT = process.env.NEXT_PUBLIC_DATA_VERIFIED_AT || "";

/** Link to the commit on GitHub; null for a "dev" or malformed hash. */
export function commitUrl(commit: string): string | null {
  return /^[0-9a-f]{7,40}$/.test(commit)
    ? `${GITHUB_REPO_URL}/commit/${commit}`
    : null;
}

/** The dataset date as the Bangkok calendar day: "13 Oct 2026" /
 *  "13 ต.ค. 2569" (Thai uses the Buddhist year by default). Null when the
 *  date is missing or invalid. */
export function formatDataDate(iso: string, lang: Lang): string | null {
  const date = new Date(iso);
  if (!iso || Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(lang === "th" ? "th-TH" : "en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Bangkok",
  }).format(date);
}

/** The dataset date as YYYY-MM-DD (Bangkok), for issue reports. */
export function dataDateIso(iso: string): string | null {
  const date = new Date(iso);
  if (!iso || Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(
    date,
  );
}

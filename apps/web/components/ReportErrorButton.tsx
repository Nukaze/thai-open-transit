// apps/web/components/ReportErrorButton.tsx
"use client";

import type { Station } from "schema";
import { t } from "../lib/i18n";

// NOTE: points at the personal-account repo because the `opentransit-th`
// GitHub org does not exist yet (CLAUDE.md lists it as "future"). Update this
// to `https://github.com/opentransit-th/bangkok-open-transit/issues/new` once
// the org is created and this repo is transferred/moved there.
const GITHUB_ISSUE_BASE_URL =
  "https://github.com/Nukaze/bangkok-open-transit/issues/new";

export function ReportErrorButton({ station }: { station: Station }) {
  const title = encodeURIComponent(
    `Data error: ${station.name_en ?? station.name_th} (${station.id})`,
  );
  const body = encodeURIComponent(
    `Station ID: ${station.id}\nName (TH): ${station.name_th}\nName (EN): ${station.name_en ?? "N/A"}\n\nWhat's wrong:\n`,
  );
  const url = `${GITHUB_ISSUE_BASE_URL}?title=${title}&body=${body}&labels=data-correction`;

  return (
    <a href={url} target="_blank" rel="noopener noreferrer">
      {t("report_error", "en")}
    </a>
  );
}

// apps/web/components/ReportErrorButton.tsx
"use client";

import type { Station } from "schema";
import { useLang } from "../lib/lang";
import { t } from "../lib/i18n";
import { FlagIcon } from "./icons";

// The repo lives on the personal account (renamed from bangkok-open-transit;
// GitHub redirects the old URL). Update this if it ever moves to an org.
const GITHUB_ISSUE_BASE_URL =
  "https://github.com/Nukaze/thai-open-transit/issues/new";

export function ReportErrorButton({ station }: { station: Station }) {
  const lang = useLang();
  const title = encodeURIComponent(
    `Data error: ${station.name_en ?? station.name_th} (${station.id})`,
  );
  const body = encodeURIComponent(
    `Station ID: ${station.id}\nName (TH): ${station.name_th}\nName (EN): ${station.name_en ?? "N/A"}\n\nWhat's wrong:\n`,
  );
  const url = `${GITHUB_ISSUE_BASE_URL}?title=${title}&body=${body}&labels=data-correction`;

  return (
    <a
      className="btn btn-secondary"
      href={url}
      target="_blank"
      rel="noopener noreferrer"
    >
      <FlagIcon />
      {t("report_error", lang)}
    </a>
  );
}

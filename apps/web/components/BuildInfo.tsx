"use client";

import { t } from "../lib/i18n";
import { useLang } from "../lib/lang";
import {
  BUILD_COMMIT,
  DATA_VERIFIED_AT,
  commitUrl,
  formatDataDate,
} from "../lib/buildInfo";

// "Data verified 6 Oct 2026 · a1b2c3d": when the data was last checked and which
// commit this site was built from (linked to GitHub). Both are stamped in at
// build time, so nothing here is ever committed by hand.
export function BuildInfo() {
  const lang = useLang();
  const date = formatDataDate(DATA_VERIFIED_AT, lang);
  const url = commitUrl(BUILD_COMMIT);
  const commitLabel = t("build_commit", lang).replace("{commit}", BUILD_COMMIT);
  return (
    <span className="footer-build">
      {date && t("data_verified", lang).replace("{date}", date)}
      {date && " · "}
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          title={commitLabel}
          aria-label={commitLabel}
        >
          {BUILD_COMMIT}
        </a>
      ) : (
        <span title={commitLabel}>{BUILD_COMMIT}</span>
      )}
    </span>
  );
}

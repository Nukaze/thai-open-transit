// apps/web/components/VisitCounter.tsx
"use client";

import { useEffect, useState } from "react";
import { t } from "../lib/i18n";
import { useLang } from "../lib/lang";
import {
  VISIT_DAY_KEY,
  bangkokDay,
  fetchStats,
  shouldRecord,
  statsConfigured,
  type VisitStats,
} from "../lib/visitCounter";
import { EyeIcon } from "./icons";

// One request per page load, shared by every mount: the footer unmounts and
// remounts as the panel switches between the station view and the list, and
// React's dev Strict Mode runs effects twice - either would otherwise count
// or fetch again.
let pageLoad: Promise<VisitStats | null> | null = null;

function loadStats(): Promise<VisitStats | null> {
  if (pageLoad) return pageLoad;
  const today = bangkokDay(new Date());
  let last: string | null = null;
  try {
    last = localStorage.getItem(VISIT_DAY_KEY);
  } catch {
    // Storage blocked: count this load, the server can't tell anyway.
  }
  const record = shouldRecord(last, today);
  pageLoad = fetchStats(record).then((result) => {
    if (result && record) {
      try {
        localStorage.setItem(VISIT_DAY_KEY, today);
      } catch {
        // Not remembered: a reload today may count again. Harmless.
      }
    }
    return result;
  });
  return pageLoad;
}

// "12,345 visits · 87 today" beside the footer links. A visit is a browser's
// first load of a Bangkok day; later loads that day only read. Renders
// nothing until the numbers arrive, and nothing at all if the stats project
// is unconfigured, paused or unreachable - the map never depends on it.
export function VisitCounter() {
  const lang = useLang();
  const [stats, setStats] = useState<VisitStats | null>(null);

  useEffect(() => {
    if (!statsConfigured) return;
    let cancelled = false;
    loadStats().then((result) => {
      if (!cancelled) setStats(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  if (!stats) return null;
  const n = new Intl.NumberFormat(lang === "th" ? "th-TH" : "en-US");
  return (
    <span className="visit-counter">
      <EyeIcon size={13} />
      {t("visits_total", lang).replace("{n}", n.format(stats.total))}
      {" · "}
      {t("visits_today", lang).replace("{n}", n.format(stats.today))}
    </span>
  );
}

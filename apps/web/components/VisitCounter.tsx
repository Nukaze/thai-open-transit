"use client";

import { useEffect, useState } from "react";
import { t } from "../lib/i18n";
import { startingLang, useLang } from "../lib/lang";
import {
  deviceClass,
  fetchStats,
  isBot,
  isLocalDev,
  statsConfigured,
  type VisitStats,
} from "../lib/visitCounter";
import { EyeIcon } from "./icons";

// One request per page load, shared by every mount: the footer unmounts and
// remounts as the panel switches between the station view and the list, and
// React's dev Strict Mode runs effects twice - either would otherwise count
// or fetch again.
let pageLoad: Promise<VisitStats | null> | null = null;

// A tab opened in the background (or prerendered) is not a view until
// someone actually looks at it.
function whenVisible(): Promise<void> {
  if (document.visibilityState === "visible") return Promise.resolve();
  return new Promise((resolve) => {
    const onChange = () => {
      if (document.visibilityState !== "visible") return;
      document.removeEventListener("visibilitychange", onChange);
      resolve();
    };
    document.addEventListener("visibilitychange", onChange);
  });
}

function loadStats(): Promise<VisitStats | null> {
  if (pageLoad) return pageLoad;
  pageLoad = whenVisible().then(() =>
    isBot(navigator.userAgent, navigator.webdriver) ||
    isLocalDev(process.env.NODE_ENV, location.hostname)
      ? fetchStats()
      : // The language the viewer starts in, resolved here rather than taken
        // from context: this effect runs before HomeClient's detection, while
        // the context still holds the prerendered "en".
        fetchStats({
          lang: startingLang(),
          device: deviceClass(window.innerWidth),
        }),
  );
  return pageLoad;
}

// "12,345 views · 87 today" beside the footer links. Every page load a person
// actually sees counts as a view, reloads included. Renders nothing until the
// numbers arrive, and nothing at all if the stats project is unconfigured,
// paused or unreachable - the map never depends on it.
export function VisitCounter() {
  const lang = useLang();
  const [stats, setStats] = useState<VisitStats | null>(null);
  // Set after mount: the prerendered HTML can't know the host.
  const [localDev, setLocalDev] = useState(false);

  useEffect(() => {
    if (!statsConfigured) return;
    let cancelled = false;
    setLocalDev(isLocalDev(process.env.NODE_ENV, location.hostname));
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
    <>
      <span className="visit-counter">
        <EyeIcon size={13} />
        {t("visits_total", lang).replace("{n}", n.format(stats.total))}
        {" · "}
        {t("visits_today", lang).replace("{n}", n.format(stats.today))}
      </span>
      <span className="visit-counter-since">{t("visits_since", lang)}</span>
      {localDev && (
        <span className="visit-counter-dev">
          <span>{t("visits_dev", lang)}</span>
        </span>
      )}
    </>
  );
}

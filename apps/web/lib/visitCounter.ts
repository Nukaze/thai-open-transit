// apps/web/lib/visitCounter.ts
//
// Client for the view counter in its own Supabase "stats" project
// (db/stats/visit_counter.sql, docs/adr/0002). Purely decorative: every
// failure resolves to null and the counter simply does not render.

import config from "./stats-config.json";
import type { Lang } from "./i18n";

export type VisitStats = { total: number; today: number };
export type DeviceClass = "mobile" | "desktop";

const TIMEOUT_MS = 5000;

/** Empty until the stats project exists; the counter stays hidden. */
export const statsConfigured =
  config.url !== "" && config.publishableKey !== "";

// Crawlers that render JavaScript (Googlebot, GPTBot, ...) and headless
// tooling (Lighthouse, Playwright). Loose on purpose: a person must never be
// miscounted as a bot. "bot" only as a product/version token
// ("Googlebot/2.1", "GPTBot/1.2"), never bare: CUBOT phones carry it in their
// model name. The SQL side repeats the check for direct calls that skip the
// site.
const BOT_UA = /bot\/|crawl|spider|slurp|headless|lighthouse/i;

/** Bots only read the numbers; they never add a view. */
export function isBot(userAgent: string, webdriver: boolean): boolean {
  return webdriver || BOT_UA.test(userAgent);
}

/** Same breakpoint as the layout (Sheet's DESKTOP_QUERY, min-width 768px). */
export function deviceClass(viewportWidth: number): DeviceClass {
  return viewportWidth >= 768 ? "desktop" : "mobile";
}

/** An RPC returning a table comes back as an array of rows. */
export function parseStats(body: unknown): VisitStats | null {
  const row = Array.isArray(body) ? body[0] : null;
  if (!row || typeof row !== "object") return null;
  const { total, today } = row as Record<string, unknown>;
  if (typeof total !== "number" || typeof today !== "number") return null;
  return { total, today };
}

export type ViewInfo = { lang: Lang; device: DeviceClass };

/** With `view`: count one page view (record_view). Without: only read
 *  (get_stats). */
export async function fetchStats(view?: ViewInfo): Promise<VisitStats | null> {
  if (!statsConfigured) return null;
  const fn = view ? "record_view" : "get_stats";
  const body = view ? { p_lang: view.lang, p_device: view.device } : {};
  try {
    const res = await fetch(`${config.url}/rest/v1/rpc/${fn}`, {
      method: "POST",
      // The publishable key goes on `apikey`, not `Authorization: Bearer`:
      // it is not a JWT (Supabase API keys guide).
      headers: {
        apikey: config.publishableKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return null;
    return parseStats(await res.json());
  } catch {
    // Offline, paused project, blocked by an extension: stay hidden.
    return null;
  }
}

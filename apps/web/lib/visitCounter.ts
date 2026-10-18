// apps/web/lib/visitCounter.ts
//
// Client for the visit counter in its own Supabase "stats" project
// (db/stats/visit_counter.sql, docs/adr/0002). Purely decorative: every
// failure resolves to null and the counter simply does not render.

import config from "./stats-config.json";

export type VisitStats = { total: number; today: number };

// localStorage key holding the Bangkok day this browser was last counted.
export const VISIT_DAY_KEY = "bot:visit-day";

const TIMEOUT_MS = 5000;

/** Empty until the stats project exists; the counter stays hidden. */
export const statsConfigured =
  config.url !== "" && config.publishableKey !== "";

/** The Bangkok calendar day of `date` as YYYY-MM-DD, matching the SQL side's
 *  `bangkok_today()`. en-CA formats dates as ISO year-month-day. */
export function bangkokDay(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** A browser is counted once per Bangkok day: on its first visit that day. */
export function shouldRecord(lastCountedDay: string | null, today: string) {
  return lastCountedDay !== today;
}

/** An RPC returning a table comes back as an array of rows. */
export function parseStats(body: unknown): VisitStats | null {
  const row = Array.isArray(body) ? body[0] : null;
  if (!row || typeof row !== "object") return null;
  const { total, today } = row as Record<string, unknown>;
  if (typeof total !== "number" || typeof today !== "number") return null;
  return { total, today };
}

/** `record`: count this visit (record_visit) or only read (get_stats). */
export async function fetchStats(record: boolean): Promise<VisitStats | null> {
  if (!statsConfigured) return null;
  const fn = record ? "record_visit" : "get_stats";
  try {
    const res = await fetch(`${config.url}/rest/v1/rpc/${fn}`, {
      method: "POST",
      // The publishable key goes on `apikey`, not `Authorization: Bearer`:
      // it is not a JWT (Supabase API keys guide).
      headers: {
        apikey: config.publishableKey,
        "Content-Type": "application/json",
      },
      body: "{}",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return null;
    return parseStats(await res.json());
  } catch {
    // Offline, paused project, blocked by an extension: stay hidden.
    return null;
  }
}

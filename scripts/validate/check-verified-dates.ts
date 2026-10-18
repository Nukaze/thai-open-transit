import type { Station, Line, Segment } from "schema";

interface NetworkForValidation {
  stations: Station[];
  lines: Line[];
  segments: Segment[];
}

// The schema already rejects malformed dates (`z.string().date()`), but a
// well-formed date in the future still passes. The web footer shows the
// newest `last_verified_at`, so one such date would outrank every correct
// one. The likeliest cause is a Buddhist-era year (2569 for 2026), which is
// what Thai admins write by habit.
const BUDDHIST_ERA_FROM = 2400;

/** `today` is YYYY-MM-DD. One day of slack covers UTC vs Bangkok. */
export function checkVerifiedDates(
  network: NetworkForValidation,
  today: string,
): string[] {
  const limit = new Date(`${today}T00:00:00Z`);
  limit.setUTCDate(limit.getUTCDate() + 1);
  const latestAllowed = limit.toISOString().slice(0, 10);

  const violations: string[] = [];
  const entities = [...network.stations, ...network.lines, ...network.segments];
  for (const entity of entities) {
    const date = entity.last_verified_at;
    if (date <= latestAllowed) continue;
    const year = Number(date.slice(0, 4));
    const hint =
      year >= BUDDHIST_ERA_FROM
        ? ` - looks like a Buddhist-era year; use AD (${year - 543}${date.slice(4)})`
        : "";
    violations.push(
      `${entity.id}: last_verified_at ${date} is in the future${hint}`,
    );
  }
  return violations;
}

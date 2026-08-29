// apps/web/lib/deep-link.ts

export function getStationIdFromUrl(url: string): string | null {
  return new URL(url).searchParams.get("station");
}

// Relative, per PUBLIC_BASE_URL rule - no origin baked in.
export function buildStationDeepLink(stationId: string): string {
  return `?station=${encodeURIComponent(stationId)}`;
}

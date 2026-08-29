// apps/web/lib/constants.ts

// Always relative. CLAUDE.md 3: "Never hardcode bangkokopentransit.vercel.app -
// Use relative URLs, or a single PUBLIC_BASE_URL constant." No custom domain
// exists yet, so this stays empty; every consumer must treat it as a prefix,
// not assume it is non-empty.
export const PUBLIC_BASE_URL = '';

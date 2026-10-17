// apps/web/lib/lineLogos.ts

// Line ID -> logo in public/line-logos/ (sources and licensing in that
// folder's README). Presentation only, so it lives with the web app rather
// than in the dataset. Mapping follows Wikipedia's "Rail transport in
// Bangkok": each BTS line has the BTS mark in a ring of its line color, MRT
// Blue uses the base MRT mark, and the newer MRT and SRT lines each have
// their own.
//
// A line missing here (a future line) falls back to its color dot.
const LINE_LOGOS: Record<string, string> = {
  ARL_AIRPORT: "arl.svg",
  BTS_GOLD: "bts-gold.svg",
  BTS_SILOM: "bts-silom.svg",
  BTS_SUKHUMVIT: "bts-sukhumvit.svg",
  MRT_BLUE: "mrt.svg",
  MRT_PINK: "mrt-pink.svg",
  MRT_PURPLE: "mrt-purple.svg",
  MRT_YELLOW: "mrt-yellow.svg",
  SRT_DARKRED: "srt-darkred.svg",
  SRT_LIGHTRED: "srt-lightred.svg",
};

export function lineLogoUrl(lineId: string): string | null {
  const file = LINE_LOGOS[lineId];
  return file ? `/line-logos/${file}` : null;
}

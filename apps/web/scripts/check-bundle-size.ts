// apps/web/scripts/check-bundle-size.ts
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { join } from "node:path";

/**
 * Enforces CLAUDE.md section 7's performance budget:
 *
 *   | First load, compressed | < 300 KB |
 *
 * That line only means something if something actually measures it. This
 * script gzips `out/index.html` itself (its inline RSC payload carries
 * whatever props Server Components pass down - see the comment above the
 * `index.html` row below) plus every JS/CSS asset it references directly
 * (the `<link rel="stylesheet">` and `<script src>` tags Next.js/Turbopack
 * emits into the initial HTML), using Node's own `zlib` (so the number
 * matches what a real HTTP server would ship over `Content-Encoding: gzip`),
 * sums them, and fails the build if the sum exceeds the budget.
 *
 * Deliberately NOT measured here: any chunk that is not referenced by
 * `index.html` itself - e.g. the `maplibre-gl` chunk pulled in by
 * `next/dynamic(() => import('./Map'), { ssr: false })` in `HomeClient.tsx`.
 * That chunk is fetched by the browser only after hydration, via a runtime
 * `import()` call, and never appears as a `<script>`/`<link>` tag in the
 * server-rendered HTML - which is exactly why the code-split moves it out of
 * the "first load" the budget is about. Including it here would defeat the
 * point of the split and re-fail a budget that is, by design, no longer
 * being violated.
 *
 * This intentionally does not try to read Next's internal build manifest
 * (`.next/`) - manifest shapes are undocumented/version-fragile, whereas
 * `out/index.html` is the literal artifact CLAUDE.md 2.4/2.5's "public plane
 * is static" contract ships to the CDN, so measuring it directly measures
 * the real thing rather than an internal representation of it.
 */

const BUDGET_BYTES = 300 * 1024; // CLAUDE.md 7: "First load, compressed: < 300 KB"

const outDir = fileURLToPath(new URL("../out/", import.meta.url));
const indexHtmlPath = join(outDir, "index.html");

if (!existsSync(indexHtmlPath)) {
  console.error(
    `check-bundle-size: ${indexHtmlPath} not found. Run \`bun run build\` first.`,
  );
  process.exit(1);
}

const html = readFileSync(indexHtmlPath, "utf-8");

// Matches both `<link ... href="/_next/static/.../foo.css">` and
// `<script ... src="/_next/static/.../foo.js">` - the two tag shapes
// Turbopack emits for statically-referenced (non-dynamically-split) assets.
// Deliberately `/_next/static/` rather than hardcoding `/_next/static/chunks/`:
// this build puts both JS and CSS under `chunks/`, but Next has historically
// used a separate `css/` directory, and a narrower path here would silently
// drop CSS out of the budget if that ever changes back - a silent
// under-count is the worst failure mode for a budget gate. Anything
// reachable only through a runtime `import()` (like the map chunk) never
// appears as a literal href/src in this file, so it is naturally excluded
// without needing to distinguish "async" from "lazy" attributes.
const assetPattern = /(?:href|src)="(\/_next\/static\/[^"]+\.(?:js|css))"/g;

const referencedPaths = new Set(
  [...html.matchAll(assetPattern)]
    .map((m) => m[1])
    .filter((path): path is string => path !== undefined),
);

if (referencedPaths.size === 0) {
  console.error(
    "check-bundle-size: found no /_next/static/chunks references in index.html - " +
      "the regex may be out of date with Next's current output shape.",
  );
  process.exit(1);
}

let totalGzipBytes = 0;
const rows: { path: string; rawBytes: number; gzipBytes: number }[] = [];

// index.html itself counts too, not just the assets it links to: Server
// Components serialize their props into an inline RSC payload
// (`self.__next_f.push(...)`) embedded directly in the HTML. Right now that
// payload is a couple hundred bytes because `data/dist/` is empty (no source
// data yet, per CLAUDE.md 8/"Current phase"), but once `page.tsx` is loading
// a populated `network.json`/`network.geojson`, the entire station/line/
// segment set gets serialized inline here - and that is unambiguously part
// of "first load, compressed." Omitting it would let this check keep
// reporting a small number while the real first-load payload grows past
// budget silently.
{
  const raw = readFileSync(indexHtmlPath);
  const gzip = gzipSync(raw, { level: 9 });
  rows.push({
    path: "index.html",
    rawBytes: raw.length,
    gzipBytes: gzip.length,
  });
  totalGzipBytes += gzip.length;
}

for (const assetPath of referencedPaths) {
  // assetPath is server-absolute (e.g. "/_next/static/chunks/foo.js"); join
  // against outDir after stripping the leading slash to read it from disk.
  const diskPath = join(outDir, assetPath.replace(/^\//, ""));
  const raw = readFileSync(diskPath);
  const gzip = gzipSync(raw, { level: 9 });
  rows.push({ path: assetPath, rawBytes: raw.length, gzipBytes: gzip.length });
  totalGzipBytes += gzip.length;
}

rows.sort((a, b) => b.gzipBytes - a.gzipBytes);

console.log("Initial-load assets referenced by out/index.html:\n");
for (const row of rows) {
  console.log(
    `  ${(row.gzipBytes / 1024).toFixed(1).padStart(7)} KB gzip  ` +
      `(${(row.rawBytes / 1024).toFixed(1).padStart(7)} KB raw)  ${row.path}`,
  );
}

const totalKB = (totalGzipBytes / 1024).toFixed(1);
const budgetKB = (BUDGET_BYTES / 1024).toFixed(0);
console.log(
  `\nTotal initial-load JS+CSS (gzip): ${totalKB} KB  (budget: < ${budgetKB} KB)`,
);

if (totalGzipBytes > BUDGET_BYTES) {
  console.error(
    `\ncheck-bundle-size: FAIL - ${totalKB} KB exceeds the ${budgetKB} KB budget ` +
      'in CLAUDE.md section 7 ("First load, compressed"). ' +
      "Investigate what is statically reachable from app/page.tsx / " +
      "components/HomeClient.tsx that shouldn't be - a common cause is a " +
      "heavy dependency (e.g. maplibre-gl) losing its next/dynamic(ssr:false) " +
      "wrapper and becoming part of the initial bundle again.",
  );
  process.exit(1);
}

console.log("\ncheck-bundle-size: PASS");

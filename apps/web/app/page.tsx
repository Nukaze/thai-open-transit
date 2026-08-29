// apps/web/app/page.tsx
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { HomeClient } from '../components/HomeClient';
import type { Line } from 'schema';
import type { FeatureCollection, Point } from 'geojson';
import type { StationWithStatus } from '../lib/types';

// This page stays a Server Component (no 'use client') so it can load the
// build artifacts with `fs` at build time, then hands the parsed data down
// as props to `HomeClient`, a Client Component that owns the interactive
// state (line filter, station selection).
//
// Why not a static `import` for either file:
// - `network.geojson`: Turbopack has no built-in module type for the
//   `.geojson` extension (unlike `.json`), so a direct
//   `import networkGeoJson from '.../network.geojson'` fails with "Unknown
//   module type". This was already discovered in Task 14.
// - `network.json`: a plain `.json` extension IS handled by Turbopack's
//   built-in JSON loader (`resolveJsonModule` in tsconfig), so
//   `import networkData from '.../network.json'` would likely build. It is
//   read with `fs` here anyway, for two reasons: (1) consistency - both
//   files come from the same generated directory and should be loaded the
//   same way, so a future change to one file's format doesn't silently
//   change how it is loaded relative to the other; (2) this file cannot be
//   a Client Component (see below) while still doing a static import
//   relative to `data/dist`, since Client Components in this Next.js/
//   Turbopack setup only bundle imports reachable from the client graph,
//   and mixing an `fs`-based Server Component with a statically-imported
//   sibling adds an inconsistent second code path for no real benefit.
//
// Why this can't be one Client Component (which is what the brief's literal
// Step 6 code assumes): a Client Component cannot call `readFileSync` -
// Node builtins are not available in the client bundle, even though under
// `output: 'export'` the component only ever runs once at build time to
// produce static HTML. Turbopack still refuses to bundle `node:fs` for a
// 'use client' module. Splitting into a Server Component (this file, does
// the `fs` reads) that passes plain-data props to a Client Component
// (`HomeClient`, owns `useState`/`useMemo` and renders `Map`, `LineFilter`,
// `StationPanel`) is the standard Next.js App Router pattern for this and
// is what actually builds.
//
// Same cross-realm `URL` quirk as Task 14's Map.tsx read: `import.meta.url`
// / `import.meta.dirname` are unreliable under this Bun-runtime + Turbopack
// build, so paths are resolved from `process.cwd()`, which Next.js
// guarantees is the package root (`apps/web`) for `next build`.
const distDir = join(process.cwd(), '../../data/dist');

const networkGeoJson = JSON.parse(
  readFileSync(join(distDir, 'network.geojson'), 'utf-8'),
) as FeatureCollection<Point>;

const networkData = JSON.parse(readFileSync(join(distDir, 'network.json'), 'utf-8')) as {
  stations: StationWithStatus[];
  lines: Line[];
};

export default function HomePage() {
  return (
    <HomeClient
      stations={networkData.stations}
      lines={networkData.lines}
      networkGeoJson={networkGeoJson}
    />
  );
}

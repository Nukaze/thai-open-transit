// apps/web/app/page.tsx
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Map } from '../components/Map';
import type { FeatureCollection, Point } from 'geojson';

// Turbopack has no built-in module type for `.geojson` (unlike `.json`), so
// a direct `import networkGeoJson from '.../network.geojson'` fails with
// "Unknown module type". This is a Server Component, and under
// `output: 'export'` it only ever runs at build time, so reading the file
// with `fs` here has the same effect as a static import would have: the
// parsed data is baked into the prerendered page.
//
// Deliberately avoids `URL`/`fileURLToPath` here: under this project's
// Bun-runtime + Turbopack build ("bun run build"), a `URL` built from
// `import.meta.url` fails Node's internal `instanceof URL`/Buffer checks in
// both `fileURLToPath` and `fs.readFileSync` directly ("Received an
// instance of URL") - a cross-realm quirk. `import.meta.dirname` is also
// unavailable here (undefined under Turbopack's page-data-collection
// worker), so this resolves relative to `process.cwd()` instead, which
// Next.js guarantees is the package root (`apps/web`) for `next build`.
const networkGeoJsonPath = join(process.cwd(), '../../data/dist/network.geojson');
const networkGeoJson = JSON.parse(
  readFileSync(networkGeoJsonPath, 'utf-8'),
) as FeatureCollection<Point>;

export default function HomePage() {
  return <Map networkGeoJson={networkGeoJson} />;
}

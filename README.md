# BangkokOpenTransit

An open, structured, versioned dataset of Bangkok's rail transit network,
covering Bangkok and its metropolitan region (Nonthaburi, Samut Prakan,
Pathum Thani).

Nobody in Thailand publishes the rail network as a structured, versioned,
temporally-aware open dataset. **The dataset is the product**; the map in
`apps/web` is a reference implementation that exists to prove the dataset is
good.

## Build it locally

Requires [Bun](https://bun.sh). No environment variables are needed - cloning
and building works offline against the data committed in `data/`.

```sh
bun install          # install workspace dependencies
bun run data:build   # generate data/dist/ artifacts from data/source/
cd apps/web && bun run dev
```

`bun run data:build` must run before the web app: `apps/web` reads
`data/dist/network.json` and `data/dist/network.geojson` at build time, and
they are generated, not committed.

`data/source/` holds the full current network (10 lines, 192 stations), so a
fresh build renders the complete map.

## Other useful commands

| Command                        | What it does                                                |
| ------------------------------ | ----------------------------------------------------------- |
| `bun run lint`                 | Prettier check                                              |
| `bun run typecheck`            | TypeScript across packages, apps and scripts                |
| `bun run test`                 | Vitest                                                      |
| `bun run data:validate`        | Schema, graph integrity, provenance and performance budgets |
| `bun run data:import`          | Fetch raw OSM data into `data/source/`                      |
| `cd apps/web && bun run build` | Static export to `apps/web/out/`                            |

`data:validate` fails on an empty network by design. If you are testing
against an empty `data/source/`, run it as `ALLOW_EMPTY=1 bun run data:validate`.

## Repository layout

See [docs/FEATURES.md](./docs/FEATURES.md) for the project goal and the list of
shipped features, [CLAUDE.md](./CLAUDE.md) for the full architecture, and
[SPEC.md](./SPEC.md) for the feature spec and roadmap. In short: `packages/schema` is the single source of truth
for entity shapes, `scripts/build` generates the published artifacts, and
`apps/web` is the public static site.

## Licensing

| Asset         | Licence      | File                           |
| ------------- | ------------ | ------------------------------ |
| Code          | AGPL-3.0     | [LICENSE-CODE](./LICENSE-CODE) |
| Data          | ODbL-1.0     | [LICENSE-DATA](./LICENSE-DATA) |
| Documentation | CC BY-SA 4.0 | -                              |

ODbL matches OpenStreetMap, a primary upstream source, which requires
share-alike anyway. Geometry is derived from OpenStreetMap and from published
MRTA/DRT/SRT documents - never traced or adapted from copyrighted transit maps.

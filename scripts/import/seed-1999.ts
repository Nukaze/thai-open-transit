// scripts/import/seed-1999.ts
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import type { Station, Line, Segment, SourceRef } from "schema";
import {
  buildGraph,
  chooseTrace,
  type OsmElement,
  type TraceCandidate,
} from "./osm-geometry";
import { stationCandidates, resolveCoords } from "./osm-stations";

/**
 * Generates the 1999-era network - the two BTS lines that opened on the
 * system's inaugural day - as schema entities under data/source/.
 *
 * Scope is deliberately one era: BTS's own history page states "Inaugurated on
 * 5th December 1999, BTS Skytrain operates on 2 lines, serving 23 stations in
 * total", with Sukhumvit running Mo Chit to On Nut and Silom running National
 * Stadium to Saphan Taksin. That gives one sourced opening date covering every
 * entity here, which is what makes the era cheap to get right. Later eras each
 * need their own dated, sourced milestones and are not guessed at here.
 *
 * Geometry comes from data/source/osm-raw.json (CLAUDE.md 2.6: OpenStreetMap
 * or official publications, never a copyrighted transit map). The ordering and
 * the 1999 station codes are curated below, because OSM carries only today's
 * codes - it has no record of what a station was called in 1999.
 */

const BTS_HISTORY: SourceRef = {
  url: "https://www.bts.co.th/eng/info/info-history.html",
  title: "BTS Skytrain - History (Bangkok Mass Transit System PCL)",
  published_at: null,
};

const OSM_EXTRACT: SourceRef = {
  url: "https://www.openstreetmap.org/relation/2064205",
  title: "OpenStreetMap - BTS Sukhumvit Line route relation",
  published_at: null,
};

const OPENING_DATE = "1999-12-05";

// The Silom Line was renumbered when Saint Louis opened as the new S4 on
// 2021-02-08, pushing Surasak to S5 and Saphan Taksin to S6. This is the
// CLAUDE.md 5 case where a station's CODE changes but its ID must not: the
// ids below are the current codes, and `code_history` carries the 1999 code
// alongside. Nothing else in the 1999 network was ever recoded.
const SILOM_RECODE_DATE = "2021-02-08";
const SAINT_LOUIS_OPENING: SourceRef = {
  url: "https://en.wikipedia.org/wiki/Saint_Louis_BTS_station",
  title: "Saint Louis BTS station - opened 8 February 2021, taking code S4",
  published_at: null,
};

type SeedStation = {
  /** Stable id. Current code, never renumbered even when the code is. */
  id: string;
  /** Station code as of 1999-12-05, when it differs from `id`. */
  code_1999?: string;
  /** OSM `ref` to look the node up by; omitted when matched on name instead. */
  osm_ref?: string;
  /** Exact OSM `name` for stations mapped only as stop_positions. */
  osm_name?: string;
  interchange_group?: string;
};

// Order matters: consecutive entries become segments.
const SUKHUMVIT_1999: SeedStation[] = [
  { id: "N8", osm_ref: "N8" },
  { id: "N7", osm_ref: "N7" },
  { id: "N5", osm_ref: "N5" },
  { id: "N4", osm_ref: "N4" },
  { id: "N3", osm_ref: "N3" },
  { id: "N2", osm_ref: "N2" },
  { id: "N1", osm_ref: "N1" },
  { id: "CEN", osm_name: "สยาม", interchange_group: "SIAM" },
  { id: "E1", osm_ref: "E1" },
  { id: "E2", osm_ref: "E2" },
  { id: "E3", osm_ref: "E3" },
  { id: "E4", osm_ref: "E4" },
  { id: "E5", osm_ref: "E5" },
  { id: "E6", osm_ref: "E6" },
  { id: "E7", osm_ref: "E7" },
  { id: "E8", osm_ref: "E8" },
  { id: "E9", osm_ref: "E9" },
];

const SILOM_1999: SeedStation[] = [
  { id: "W1", osm_name: "สนามกีฬาแห่งชาติ" },
  { id: "CEN", osm_name: "สยาม", interchange_group: "SIAM" },
  { id: "S1", osm_ref: "S1" },
  { id: "S2", osm_ref: "S2" },
  { id: "S3", osm_ref: "S3" },
  { id: "S5", code_1999: "S4", osm_ref: "S5" },
  { id: "S6", code_1999: "S5", osm_ref: "S6" },
];

const SUKHUMVIT_LINE: Line = {
  id: "BTS_SUKHUMVIT",
  operator: "BTS",
  name_th: "รถไฟฟ้าบีทีเอส สายสุขุมวิท",
  name_en: "BTS Sukhumvit Line",
  color_hex: "#65B724",
  milestones: [
    {
      date: OPENING_DATE,
      date_precision: "exact",
      event: "opened",
      source_refs: [BTS_HISTORY],
    },
  ],
  confidence: "high",
  last_verified_at: "2026-08-30",
};

const SILOM_LINE: Line = {
  id: "BTS_SILOM",
  operator: "BTS",
  name_th: "รถไฟฟ้าบีทีเอส สายสีลม",
  name_en: "BTS Silom Line",
  color_hex: "#02817D",
  milestones: [
    {
      date: OPENING_DATE,
      date_precision: "exact",
      event: "opened",
      source_refs: [BTS_HISTORY],
    },
  ],
  confidence: "high",
  last_verified_at: "2026-08-30",
};

const LINES: Line[] = [SUKHUMVIT_LINE, SILOM_LINE];

function loadOsm(): OsmElement[] {
  const raw = JSON.parse(
    readFileSync(
      new URL("../../data/source/osm-raw.json", import.meta.url),
      "utf-8",
    ),
  ) as { elements: OsmElement[] };
  return raw.elements;
}

function buildStation(
  seed: SeedStation,
  lineIds: string[],
  elements: OsmElement[],
): Station {
  const { lat, lon, name_th, name_en } = resolveCoords(seed, elements, seed.id);
  const candidates = stationCandidates(seed, elements);

  const code_history = seed.code_1999
    ? [
        { code: seed.code_1999, from: OPENING_DATE, to: SILOM_RECODE_DATE },
        { code: seed.id, from: SILOM_RECODE_DATE, to: null },
      ]
    : [{ code: seed.id, from: OPENING_DATE, to: null }];

  const milestones: Station["milestones"] = [
    {
      date: OPENING_DATE,
      date_precision: "exact",
      event: "opened",
      source_refs: [BTS_HISTORY],
    },
  ];
  if (seed.code_1999) {
    milestones.push({
      date: SILOM_RECODE_DATE,
      date_precision: "exact",
      event: "recoded",
      source_refs: [SAINT_LOUIS_OPENING],
    });
  }

  return {
    id: seed.id,
    name_th,
    name_en,
    code_history,
    interchange_group: seed.interchange_group ?? null,
    // Every 1999 BTS station is elevated - the whole inaugural system is a
    // viaduct. Not derived from OSM, which does not tag this consistently.
    structure: "elevated",
    // `accessible` is a required boolean but OSM only tags `wheelchair` on a
    // minority of these nodes, so "no tag" collapses to false. That is a
    // schema limitation worth an ADR (the field wants a third "unknown"
    // state); until then station confidence stays "medium" because of it.
    // Read from the SAME nodes that produced the coordinate. The previous
    // version matched `ref === seed.osm_ref && railway === "station"`, which
    // failed in both directions: for CEN and W1 (matched by name, so
    // `osm_ref` is undefined) it matched any `railway=station` node without a
    // `ref` - in practice Suvarnabhumi's Midfield Satellite Concourse - and
    // published its `wheelchair=yes` as theirs; for Sukhumvit stations, which
    // are `stop_position` nodes, it matched nothing and published `false`
    // regardless of what OSM actually says.
    accessible: candidates.some((e) => e.tags?.wheelchair === "yes"),
    coords: { geo: { lat, lon } },
    validity: lineIds.map((line) => ({ line, from: OPENING_DATE, to: null })),
    milestones,
    status: "operational",
    confidence: "medium",
    last_verified_at: "2026-08-30",
  };
}

/**
 * One trace candidate per matching route relation - deliberately not merged.
 * See `chooseTrace` for why pooling a line's two directions produces detours.
 */
function traceCandidates(
  elements: OsmElement[],
  namePrefixes: string[],
  nodes: Map<number, OsmElement>,
): TraceCandidate[] {
  const candidates: TraceCandidate[] = [];
  for (const element of elements) {
    if (element.type !== "relation") continue;
    const name = element.tags?.["name:en"] ?? "";
    if (!namePrefixes.some((prefix) => name.startsWith(prefix))) continue;

    // role "" is the track itself; "stop" and "platform" members are points
    // and areas, not the alignment.
    const wayRefs = new Set(
      (element.members ?? [])
        .filter((member) => member.type === "way" && member.role === "")
        .map((member) => member.ref),
    );
    const ways = elements.filter((e) => e.type === "way" && wayRefs.has(e.id));
    if (ways.length === 0) continue;
    candidates.push({ graph: buildGraph(ways, nodes) });
  }
  return candidates;
}

function buildSegments(
  line: Line,
  seeds: SeedStation[],
  stationById: Map<string, Station>,
  elements: OsmElement[],
  namePrefixes: string[],
): { segments: Segment[]; traced: number } {
  const nodes = new Map(
    elements.filter((e) => e.type === "node").map((e) => [e.id, e]),
  );
  const candidates = traceCandidates(elements, namePrefixes, nodes);

  let traced = 0;
  const segments = seeds.slice(0, -1).map((from, i) => {
    // `slice(0, -1)` guarantees a successor, but the index signature does not
    // narrow under noUncheckedIndexedAccess.
    const to = seeds[i + 1]!;
    const fromStation = stationById.get(from.id)!;
    const toStation = stationById.get(to.id)!;

    const trace = chooseTrace(
      candidates,
      nodes,
      [fromStation.coords.geo.lon, fromStation.coords.geo.lat],
      [toStation.coords.geo.lon, toStation.coords.geo.lat],
    );
    if (trace !== null) traced++;

    return {
      id: `${from.id}__${to.id}`,
      line: line.id,
      from_station: from.id,
      to_station: to.id,
      // Null geometry is not an error - the build draws a chord instead. It
      // just means this segment has not been traced yet.
      geometry:
        trace === null
          ? null
          : { type: "LineString" as const, coordinates: trace.coordinates },
      geometry_source: (trace === null ? "straight" : "osm") as
        "straight" | "osm",
      osm_way_refs: trace?.wayRefs ?? [],
      validity: [{ from: OPENING_DATE, to: null }],
      milestones: [
        {
          date: OPENING_DATE,
          date_precision: "exact" as const,
          event: "opened" as const,
          source_refs: [BTS_HISTORY, OSM_EXTRACT],
        },
      ],
      confidence: "medium" as const,
      last_verified_at: "2026-08-30",
    };
  });

  return { segments, traced };
}

function main() {
  const elements = loadOsm();
  const sourceDir = new URL("../../data/source/", import.meta.url);

  // Stations serving both lines (Siam) must appear once, with both lines in
  // `validity` - a duplicate id would silently overwrite the other line's copy
  // and drop one line from the station's history.
  const linesByStationId = new Map<string, string[]>();
  const seedsById = new Map<string, SeedStation>();
  for (const [seeds, line] of [
    [SUKHUMVIT_1999, SUKHUMVIT_LINE],
    [SILOM_1999, SILOM_LINE],
  ] as const) {
    for (const seed of seeds) {
      // Siam is on both lines, so it is seeded twice. Overwriting silently is
      // the failure the comment above warns about: a future disagreement on
      // `code_1999` or `interchange_group` between the two entries would
      // publish whichever came last, with no error.
      const existing = seedsById.get(seed.id);
      if (existing !== undefined) {
        if (JSON.stringify(existing) !== JSON.stringify(seed)) {
          throw new Error(
            `Conflicting seed entries for station ${seed.id}: ${JSON.stringify(existing)} vs ${JSON.stringify(seed)}`,
          );
        }
      }
      seedsById.set(seed.id, seed);
      linesByStationId.set(seed.id, [
        ...(linesByStationId.get(seed.id) ?? []),
        line.id,
      ]);
    }
  }

  const stations = [...seedsById.values()].map((seed) =>
    buildStation(seed, linesByStationId.get(seed.id)!, elements),
  );
  const stationById = new Map(stations.map((station) => [station.id, station]));

  const sukhumvit = buildSegments(
    SUKHUMVIT_LINE,
    SUKHUMVIT_1999,
    stationById,
    elements,
    ["BTS Sukhumvit Line"],
  );
  const silom = buildSegments(SILOM_LINE, SILOM_1999, stationById, elements, [
    "BTS Silom Line",
  ]);
  const segments = [...sukhumvit.segments, ...silom.segments];
  const traced = sukhumvit.traced + silom.traced;

  for (const [dir, entities] of [
    ["stations", stations],
    ["lines", LINES],
    ["segments", segments],
  ] as const) {
    const outDir = new URL(`${dir}/`, sourceDir);
    // Writes only this run's ids; it does NOT clear the directory. The
    // previous version did an `rmSync(..., { recursive: true })` on each
    // output directory, so re-running the seeder after any other era or
    // importer had written there would destroy those files - and
    // `data/source/` is write-once (CLAUDE.md 4). Entities this seeder no
    // longer produces are removed deliberately, in a reviewed commit, where
    // the deletion is visible in the diff.
    mkdirSync(outDir, { recursive: true });
    for (const entity of entities) {
      writeFileSync(
        new URL(`${entity.id}.json`, outDir),
        `${JSON.stringify(entity, null, 2)}\n`,
      );
    }
  }

  console.log(
    `Seeded ${stations.length} stations, ${LINES.length} lines, ${segments.length} segments ` +
      `(${traced} traced from OSM, ${segments.length - traced} straight-line fallback) ` +
      `for the ${OPENING_DATE} network`,
  );
}

main();

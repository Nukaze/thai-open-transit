// scripts/import/seed-new-lines-2020-2025.ts
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import type {
  Station,
  Line,
  Segment,
  SourceRef,
  Milestone,
  DatePrecision,
} from "schema";
import {
  buildGraph,
  chooseTrace,
  type OsmElement,
  type TraceCandidate,
} from "./osm-geometry";
import { resolveCoords, resolveAccessible } from "./osm-stations";

/**
 * Adds the three lines that opened between 2020 and 2025: BTS Gold (2020),
 * MRT Yellow (2023) and MRT Pink (2024), including Pink's Muang Thong Thani
 * branch (2025). Run after seed-1999.ts and seed-2019.ts. It touches only
 * entities it owns (BTS_GOLD, MRT_YELLOW, MRT_PINK and their stations and
 * segments), so it never rewrites a file another seed script writes.
 *
 * Decisions that are not obvious from the data alone:
 *
 * - The Muang Thong Thani branch (PK10 -> MT01 -> MT02) belongs to MRT_PINK,
 *   not to a separate Line. LineSchema ids must match {OPERATOR}_{COLOR}, so a
 *   branch id such as MRT_PINK_MTT is illegal, and Line has no parent field.
 *   The operator (Northern Bangkok Monorail), the brand and the fare scheme
 *   are shared as well: a trip from a main-line station to MT01 is priced as
 *   one journey. The branch is therefore expressed as a second group of
 *   stations and segments on MRT_PINK, plus an `extended` Line milestone.
 *
 * - `opened` means the start of revenue service (fares charged). Pink was
 *   "officially launched" on 2023-12-18, but that was a ceremonial launch in
 *   the middle of a free public trial that began 2023-11-21. Fares started
 *   2024-01-07, after a conductor rail fell on 2023-12-24 and the free period
 *   was extended from 2024-01-02 to 2024-01-06.
 *
 * - `construction_started` is the notice-to-proceed (2018-06-29, both Pink
 *   and Yellow, per the operators), not the 2017-06-16 contract signing. The
 *   branch uses the month of its notice to proceed (June 2022).
 *
 * - A segment's trial and opening dates are the LATER of its two end
 *   stations' dates. Yellow's trial grew from the Samrong end toward Lat
 *   Phrao in three stages, so dating a segment by its destination alone
 *   (seed-2019's rule) would give YL10__YL11 a date before YL10 was open.
 *
 * - interchange_group is left null everywhere. Cross-line groups need the
 *   other lines' stations, which another step owns.
 *
 * Geometry and Thai/English names come from data/source/osm-raw.json
 * (CLAUDE.md 2.6). Dates are curated below.
 */

type Dated = {
  /** YYYY-MM-DD; month and year precision still carry a full date (day 01). */
  date: string;
  precision?: DatePrecision;
  source_refs: SourceRef[];
};

type SeedStation = {
  /** Stable id, equal to the station code at opening. */
  id: string;
  /** OSM `ref` to look the node up by. */
  osm_ref?: string;
  /** Explicit OSM node ids, for stations whose name or ref is shared with
   * another line's station (Gold's Krung Thon Buri shares S7's name). */
  osm_node_ids?: number[];
  structure: Station["structure"];
  construction?: Dated;
  trial_run?: Dated;
  opened: Dated;
};

const ref = (
  url: string,
  title: string,
  published_at: string | null = null,
): SourceRef => ({ url, title, published_at });

// --- Sources (every URL below was fetched while preparing this script) ------
const GOLD_WIKI = ref(
  "https://en.wikipedia.org/wiki/Gold_Line_(Bangkok)",
  "Gold Line (Bangkok) - Wikipedia (preliminary works June 2018, major construction September 2018; test runs from 11 September 2020; opened 16 December 2020)",
);
const GOLD_RAILTECH = ref(
  "https://www.railway-technology.com/projects/gold-line-automated-mass-transit-system/",
  "Gold Line Automated Mass Transit System, Bangkok - Railway Technology (construction start August 2018)",
);
const GOLD_NATION_TEST = ref(
  "https://www.nationthailand.com/news/30394429",
  "Gold Line monorail set to roll out in October after successful test run - The Nation (test run on Friday 11 September 2020)",
  "2020-09-12",
);
const GOLD_RAILGAZ = ref(
  "https://www.railwaygazette.com/bangkok-gold-line-peoplemover-opens/58047.article",
  "Bangkok Gold Line peoplemover opens - Railway Gazette International",
  "2020-12-16",
);
const GOLD_NATION_OPEN = ref(
  "https://www.nationthailand.com/in-focus/30399052",
  "Gold Line monorail to open Dec 16 at Bt15 per trip - The Nation",
  "2020-12-03",
);

const EBM_HISTORY = ref(
  "https://ebm.co.th/en/history/",
  "Eastern Bangkok Monorail - History (contract signed 16 June 2017; notice to proceed for the Yellow Line issued 29 June 2018)",
);
const YELLOW_WIKI = ref(
  "https://en.wikipedia.org/wiki/Yellow_Line_(Bangkok)",
  "Yellow Line (Bangkok) - Wikipedia (trial 3 June 2023 from Hua Mak to Samrong, Phawana-Hua Mak 12 June, Lat Phrao 19 June; opened 3 July 2023)",
);
const YELLOW_WIKI_PHAWANA = ref(
  "https://en.wikipedia.org/wiki/Phawana_MRT_station",
  "Phawana MRT station - Wikipedia (trial operations between Hua Mak and Phawana from 12 June 2023)",
);
const YELLOW_THAIPBS = ref(
  "https://www.thaipbsworld.com/around-thailand/yellow-line-train-free-trial-service-to-be-extended-to-22-stations-from-monday",
  "Yellow Line train free trial service to be extended to 22 stations from Monday - Thai PBS World (13 stations Hua Mak to Samrong, extended to 22 stations on 12 June 2023)",
  "2023-06-11",
);
const YELLOW_MRTA_JUN19 = ref(
  "https://www.mrta.co.th/en/news-release/13688",
  "MRTA - Yellow Line trial run extended to Lat Phrao, all 23 stations open to the public from 19 June 2023",
  "2023-06-19",
);
const YELLOW_NATION_FARES = ref(
  "https://www.nationthailand.com/thailand/general/40028424",
  "Fares to be collected on Yellow Line from July 3: MRTA - The Nation (free trial started 3 June 2023)",
  "2023-06-11",
);

const NBM_HISTORY = ref(
  "https://nbm.co.th/en/history/",
  "Northern Bangkok Monorail - History (contract signed 16 June 2017; notice to proceed for the Pink Line issued 29 June 2018)",
);
const PINK_WIKI = ref(
  "https://en.wikipedia.org/wiki/Pink_Line_(Bangkok)",
  "Pink Line (Bangkok) - Wikipedia (free trial 21 November 2023, official launch 18 December 2023, revenue service 7 January 2024; Muang Thong Thani branch notice to proceed 20 June 2022, trial 20 May 2025)",
);
const PINK_BTSGROUP_TRIAL = ref(
  "https://www.btsgroup.co.th/en/update/news-event/909/prime-minister-srettha-thavisin-joins-trial-run-of-pink-line-mrt",
  "Prime Minister Srettha Thavisin Joins Trial Run of Pink Line MRT - BTS Group (free public trial from 21 November 2023)",
  "2023-11-21",
);
const PINK_THAIGER_FARES = ref(
  "https://thethaiger.com/news/national/pink-line-monorail-extends-free-service-during-conductor-rail-repair",
  "Pink line monorail extends free service during conductor rail repair - The Thaiger (free until 6 January 2024, fares from 7 January)",
  "2024-01-01",
);
const BRANCH_THAIPBS = ref(
  "https://www.thaipbsworld.com/around-thailand/free-trail-of-pink-line%E2%80%99s-new-extension-runs-from-today-until-june-16th",
  "Free trial of Pink Line's new extension runs from today until June 16th - Thai PBS World (commercial service from 17 June 2025)",
  "2025-05-20",
);
const BRANCH_SEAINFRA = ref(
  "https://southeastasiainfra.com/muang-thong-thani-pink-line-extension-begins-commercial-operations/",
  "Muang Thong Thani Pink Line Extension begins commercial operations - Southeast Asia Infrastructure (trial 20 May to 16 June 2025, commercial from 17 June 2025)",
  "2025-06-19",
);

const d = (
  date: string,
  source_refs: SourceRef[],
  precision: DatePrecision = "exact",
): Dated => ({ date, precision, source_refs });

// --- BTS Gold ----------------------------------------------------------------
// The test run on 2020-09-11 was a closed run announced by the Bangkok
// governor, not a public trial. It is the only pre-opening operating
// milestone any retrieved source dates, so it is recorded as trial_run.
const GOLD_TRIAL = d("2020-09-11", [GOLD_NATION_TEST, GOLD_WIKI]);
const GOLD_OPENED = d("2020-12-16", [
  GOLD_RAILGAZ,
  GOLD_NATION_OPEN,
  GOLD_WIKI,
]);
const GOLD_SEEDS: SeedStation[] = [
  {
    id: "G1",
    osm_node_ids: [7781133227],
    structure: "elevated",
    trial_run: GOLD_TRIAL,
    opened: GOLD_OPENED,
  },
  {
    id: "G2",
    osm_node_ids: [11012357560, 11012357573],
    structure: "elevated",
    trial_run: GOLD_TRIAL,
    opened: GOLD_OPENED,
  },
  {
    id: "G3",
    osm_node_ids: [11012357562],
    structure: "elevated",
    trial_run: GOLD_TRIAL,
    opened: GOLD_OPENED,
  },
];

// --- MRT Yellow --------------------------------------------------------------
// Trial stages: YL11-YL23 on 2023-06-03, YL02-YL10 on 2023-06-12, YL01 on
// 2023-06-19. Revenue service started on every station on 2023-07-03.
const YELLOW_OPENED = d("2023-07-03", [YELLOW_NATION_FARES, YELLOW_WIKI]);
const YELLOW_TRIAL_1 = d("2023-06-03", [
  YELLOW_NATION_FARES,
  YELLOW_THAIPBS,
  YELLOW_WIKI,
]);
const YELLOW_TRIAL_2 = d("2023-06-12", [YELLOW_THAIPBS, YELLOW_WIKI_PHAWANA]);
const YELLOW_TRIAL_3 = d("2023-06-19", [YELLOW_MRTA_JUN19, YELLOW_WIKI]);

const yellowSeed = (n: number): SeedStation => {
  const id = `YL${String(n).padStart(2, "0")}`;
  return {
    id,
    osm_ref: id,
    structure: "elevated",
    trial_run:
      n === 1 ? YELLOW_TRIAL_3 : n <= 10 ? YELLOW_TRIAL_2 : YELLOW_TRIAL_1,
    opened: YELLOW_OPENED,
  };
};
const YELLOW_SEEDS: SeedStation[] = Array.from({ length: 23 }, (_, i) =>
  yellowSeed(i + 1),
);

// --- MRT Pink ----------------------------------------------------------------
const PINK_TRIAL = d("2023-11-21", [PINK_BTSGROUP_TRIAL, PINK_WIKI]);
const PINK_OPENED = d("2024-01-07", [PINK_THAIGER_FARES, PINK_WIKI]);
const pinkSeed = (n: number): SeedStation => {
  const id = `PK${String(n).padStart(2, "0")}`;
  return {
    id,
    osm_ref: id,
    structure: "elevated",
    trial_run: PINK_TRIAL,
    opened: PINK_OPENED,
  };
};
const PINK_SEEDS: SeedStation[] = Array.from({ length: 30 }, (_, i) =>
  pinkSeed(i + 1),
);

// Muang Thong Thani branch: PK10 -> MT01 -> MT02. The notice to proceed was
// issued 2022-06-20 (Wikipedia only), so it is recorded at month precision.
const BRANCH_CONSTRUCTION = d("2022-06-01", [PINK_WIKI], "month");
const BRANCH_TRIAL = d("2025-05-20", [BRANCH_THAIPBS, PINK_WIKI]);
const BRANCH_OPENED = d("2025-06-17", [BRANCH_THAIPBS, BRANCH_SEAINFRA]);
const branchSeed = (id: string): SeedStation => ({
  id,
  osm_ref: id,
  structure: "elevated",
  construction: BRANCH_CONSTRUCTION,
  trial_run: BRANCH_TRIAL,
  opened: BRANCH_OPENED,
});
const BRANCH_SEEDS: SeedStation[] = [
  // PK10 is written by the main-line group; it is listed here only so the
  // branch segment can chain to it. Its own dates stay the main line's.
  PINK_SEEDS[9]!,
  branchSeed("MT01"),
  branchSeed("MT02"),
];

// --- Lines -------------------------------------------------------------------
const BTS_GOLD_LINE: Line = {
  id: "BTS_GOLD",
  operator: "BTS",
  name_th: "รถไฟฟ้าบีทีเอส สายสีทอง",
  name_en: "BTS Gold Line",
  color_hex: "#A58704",
  milestones: [
    {
      // Wikipedia: preliminary works June 2018, major works September 2018.
      // Railway Technology: August 2018. The sources disagree on the month.
      date: "2018-08-01",
      date_precision: "disputed",
      event: "construction_started",
      source_refs: [GOLD_WIKI, GOLD_RAILTECH],
    },
    {
      date: GOLD_TRIAL.date,
      date_precision: "exact",
      event: "trial_run",
      source_refs: GOLD_TRIAL.source_refs,
    },
    {
      date: GOLD_OPENED.date,
      date_precision: "exact",
      event: "opened",
      source_refs: GOLD_OPENED.source_refs,
    },
  ],
  confidence: "medium",
  last_verified_at: "2026-10-06",
};

const MRT_YELLOW_LINE: Line = {
  id: "MRT_YELLOW",
  operator: "EBM",
  name_th: "รถไฟฟ้ามหานคร สายสีเหลือง",
  name_en: "MRT Yellow Line",
  color_hex: "#FFD400",
  milestones: [
    {
      date: "2018-06-29",
      date_precision: "exact",
      event: "construction_started",
      source_refs: [EBM_HISTORY],
    },
    {
      date: YELLOW_TRIAL_1.date,
      date_precision: "exact",
      event: "trial_run",
      source_refs: YELLOW_TRIAL_1.source_refs,
    },
    {
      date: YELLOW_OPENED.date,
      date_precision: "exact",
      event: "opened",
      source_refs: YELLOW_OPENED.source_refs,
    },
  ],
  confidence: "high",
  last_verified_at: "2026-10-06",
};

const MRT_PINK_LINE: Line = {
  id: "MRT_PINK",
  operator: "NBM",
  name_th: "รถไฟฟ้ามหานคร สายสีชมพู",
  name_en: "MRT Pink Line",
  color_hex: "#E76589",
  milestones: [
    {
      date: "2018-06-29",
      date_precision: "exact",
      event: "construction_started",
      source_refs: [NBM_HISTORY],
    },
    {
      date: PINK_TRIAL.date,
      date_precision: "exact",
      event: "trial_run",
      source_refs: PINK_TRIAL.source_refs,
    },
    {
      date: PINK_OPENED.date,
      date_precision: "exact",
      event: "opened",
      source_refs: PINK_OPENED.source_refs,
    },
    // Muang Thong Thani branch, restated on the parent line (see header).
    {
      date: BRANCH_CONSTRUCTION.date,
      date_precision: "month",
      event: "construction_started",
      source_refs: BRANCH_CONSTRUCTION.source_refs,
    },
    {
      date: BRANCH_TRIAL.date,
      date_precision: "exact",
      event: "trial_run",
      source_refs: BRANCH_TRIAL.source_refs,
    },
    {
      date: BRANCH_OPENED.date,
      date_precision: "exact",
      event: "extended",
      source_refs: BRANCH_OPENED.source_refs,
    },
  ],
  confidence: "high",
  last_verified_at: "2026-10-06",
};

const LINES: Line[] = [BTS_GOLD_LINE, MRT_YELLOW_LINE, MRT_PINK_LINE];

// --- Builders ----------------------------------------------------------------
function loadOsm(): OsmElement[] {
  const raw = JSON.parse(
    readFileSync(
      new URL("../../data/source/osm-raw.json", import.meta.url),
      "utf-8",
    ),
  ) as { elements: OsmElement[] };
  return raw.elements;
}

function resolveSeed(
  seed: SeedStation,
  elements: OsmElement[],
): {
  lat: number;
  lon: number;
  name_th: string;
  name_en: string | null;
  accessible: boolean;
} {
  if (seed.osm_node_ids === undefined) {
    const coords = resolveCoords(seed, elements, seed.id);
    return { ...coords, accessible: resolveAccessible(seed, elements) };
  }
  const nodes = seed.osm_node_ids.map((id) => {
    const node = elements.find((e) => e.type === "node" && e.id === id);
    if (
      node === undefined ||
      node.lat === undefined ||
      node.lon === undefined
    ) {
      throw new Error(`OSM node ${id} for seed station ${seed.id} not found`);
    }
    return node;
  });
  const first = nodes[0]!;
  return {
    lat: nodes.reduce((sum, n) => sum + n.lat!, 0) / nodes.length,
    lon: nodes.reduce((sum, n) => sum + n.lon!, 0) / nodes.length,
    name_th: first.tags?.name ?? seed.id,
    name_en: first.tags?.["name:en"] ?? null,
    accessible: nodes.some((n) => n.tags?.wheelchair === "yes"),
  };
}

const toMilestone = (event: Milestone["event"], dated: Dated): Milestone => ({
  date: dated.date,
  date_precision: dated.precision ?? "exact",
  event,
  source_refs: dated.source_refs,
});

function buildStation(
  seed: SeedStation,
  lineId: string,
  elements: OsmElement[],
): Station {
  const { lat, lon, name_th, name_en, accessible } = resolveSeed(
    seed,
    elements,
  );

  const milestones: Milestone[] = [];
  if (seed.construction) {
    milestones.push(toMilestone("construction_started", seed.construction));
  }
  if (seed.trial_run) milestones.push(toMilestone("trial_run", seed.trial_run));
  milestones.push(toMilestone("opened", seed.opened));

  return {
    id: seed.id,
    name_th,
    name_en,
    code_history: [{ code: seed.id, from: seed.opened.date, to: null }],
    interchange_group: null,
    structure: seed.structure,
    accessible,
    coords: { geo: { lat, lon } },
    validity: [{ line: lineId, from: seed.opened.date, to: null }],
    milestones,
    status: "operational",
    confidence: "medium",
    last_verified_at: "2026-10-06",
  };
}

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

/** The later of two optional dates; the second wins a tie. */
function laterOf(
  a: Dated | undefined,
  b: Dated | undefined,
): Dated | undefined {
  if (a === undefined) return b;
  if (b === undefined) return a;
  return a.date > b.date ? a : b;
}

function buildSegments(
  lineId: string,
  seeds: SeedStation[],
  stationById: Map<string, Station>,
  elements: OsmElement[],
  namePrefixes: string[],
): { segments: Segment[]; traced: number; untraced: string[] } {
  const nodes = new Map(
    elements.filter((e) => e.type === "node").map((e) => [e.id, e]),
  );
  const candidates = traceCandidates(elements, namePrefixes, nodes);

  let traced = 0;
  const untraced: string[] = [];
  const segments = seeds.slice(0, -1).map((from, i) => {
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
    else untraced.push(`${from.id}__${to.id}`);

    const construction = laterOf(from.construction, to.construction);
    const trial = laterOf(from.trial_run, to.trial_run);
    const opened = laterOf(from.opened, to.opened)!;

    const milestones: Milestone[] = [];
    if (construction) {
      milestones.push(toMilestone("construction_started", construction));
    }
    if (trial) milestones.push(toMilestone("trial_run", trial));
    milestones.push(toMilestone("opened", opened));

    return {
      id: `${from.id}__${to.id}`,
      line: lineId,
      from_station: from.id,
      to_station: to.id,
      geometry:
        trace === null
          ? null
          : { type: "LineString" as const, coordinates: trace.coordinates },
      geometry_source: (trace === null ? "straight" : "osm") as
        "straight" | "osm",
      osm_way_refs: trace?.wayRefs ?? [],
      validity: [{ from: opened.date, to: null }],
      milestones,
      confidence: "medium" as const,
      last_verified_at: "2026-10-06",
    };
  });

  return { segments, traced, untraced };
}

function main() {
  const elements = loadOsm();
  const sourceDir = new URL("../../data/source/", import.meta.url);

  const groups: {
    seeds: SeedStation[];
    lineId: string;
    namePrefixes: string[];
    skipWriteIds: Set<string>;
  }[] = [
    {
      seeds: GOLD_SEEDS,
      lineId: "BTS_GOLD",
      namePrefixes: ["Gold Line"],
      skipWriteIds: new Set(),
    },
    {
      seeds: YELLOW_SEEDS,
      lineId: "MRT_YELLOW",
      namePrefixes: ["Yellow Line"],
      skipWriteIds: new Set(),
    },
    {
      seeds: PINK_SEEDS,
      lineId: "MRT_PINK",
      namePrefixes: ["MRT Pink Line"],
      skipWriteIds: new Set(),
    },
    {
      seeds: BRANCH_SEEDS,
      lineId: "MRT_PINK",
      namePrefixes: ["Pink Line MRT (Muang Thong Thani"],
      skipWriteIds: new Set(["PK10"]),
    },
  ];

  const allStations = new Map<string, Station>();
  const stationsToWrite = new Map<string, Station>();
  const allSegments: Segment[] = [];
  const untraced: string[] = [];
  let totalTraced = 0;

  for (const group of groups) {
    for (const seed of group.seeds) {
      if (allStations.has(seed.id)) continue; // PK10 appears in two groups
      const station = buildStation(seed, group.lineId, elements);
      allStations.set(seed.id, station);
      if (!group.skipWriteIds.has(seed.id))
        stationsToWrite.set(seed.id, station);
    }
  }

  for (const group of groups) {
    const result = buildSegments(
      group.lineId,
      group.seeds,
      allStations,
      elements,
      group.namePrefixes,
    );
    allSegments.push(...result.segments);
    untraced.push(...result.untraced);
    totalTraced += result.traced;
  }

  for (const [dir, entities] of [
    ["stations", [...stationsToWrite.values()]],
    ["lines", LINES],
    ["segments", allSegments],
  ] as const) {
    const outDir = new URL(`${dir}/`, sourceDir);
    mkdirSync(outDir, { recursive: true });
    for (const entity of entities) {
      writeFileSync(
        new URL(`${entity.id}.json`, outDir),
        `${JSON.stringify(entity, null, 2)}\n`,
      );
    }
  }

  console.log(
    `Seeded ${stationsToWrite.size} stations, ${LINES.length} lines, ` +
      `${allSegments.length} segments (${totalTraced} traced from OSM, ` +
      `${allSegments.length - totalTraced} straight-line fallback) for Gold, Yellow and Pink`,
  );
  if (untraced.length > 0) {
    console.log(`Untraced segments: ${untraced.join(", ")}`);
  }
}

main();

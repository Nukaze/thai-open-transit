// scripts/import/seed-red-arl.ts
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import type { Station, Line, Segment, SourceRef, Milestone } from "schema";
import {
  buildGraph,
  chooseTrace,
  type OsmElement,
  type TraceCandidate,
} from "./osm-geometry";
import { resolveCoords, resolveAccessible } from "./osm-stations";

/**
 * Adds three lines that osm-raw.json cannot supply: SRT Dark Red, SRT Light
 * Red and the Airport Rail Link. They are tagged route=train in OSM and live in
 * data/source/osm-raw-train.json (`bun run scripts/import/index.ts --train`).
 *
 * This script writes NEW entity files only. It never rewrites a station,
 * line or segment owned by seed-1999.ts or seed-2019.ts, so run order relative
 * to those two does not matter, and re-running it is idempotent.
 *
 * Line ids: the Line schema requires `^[A-Z]+_[A-Z]+$`, so SRT_DARK_RED and
 * AIRPORT_RAIL_LINK are not valid ids; SRT_DARKRED, SRT_LIGHTRED and
 * ARL_AIRPORT are the closest conforming forms.
 *
 * Scope decisions (see the PR description):
 * - Operator changes (ARL moving from SRTET to Asia Era One in Oct 2021) are
 *   NOT modelled; they wait for an ADR. `operator` is the original operator.
 * - Light Red infill stations RW03 Phra Ram 6 and RW04 Bang Kruai-EGAT were not
 *   open in 2021 and are absent from OSM; only the four opened stations exist.
 * - interchange_group is null everywhere except the Krung Thep Aphiwat station
 *   shared by both Red lines. Cross-operator links are a later integration step.
 */

const OPENED_TRIAL = "2021-08-02";
const OPENED_COMMERCIAL = "2021-11-29";

const REF_RED_TRIAL: SourceRef = {
  url: "https://www.pattayamail.com/thailandnews/bangkok-pushes-start-red-line-rangsit-bang-sue-taling-chan-route-3-months-free-test-run-366095",
  title:
    "Pattaya Mail - Bangkok pushes start 'Red Line' Rangsit-Bang Sue-Taling Chan route, 3 months free test-run (2 August 2021)",
  published_at: "2021-08-02",
};
const REF_RED_COMMERCIAL: SourceRef = {
  url: "https://thethaiger.com/news/bangkok/bangkoks-red-line-starts-fares-at-12-baht-maximum-at-42-baht",
  title:
    "The Thaiger - Bangkok's Red Line starts fares at 12 baht, maximum at 42 baht (ticket sales from 29 November 2021)",
  published_at: null,
};
const REF_DARK_WIKI: SourceRef = {
  url: "https://en.wikipedia.org/wiki/Dark_Red_Line_(Bangkok)",
  title:
    "Dark Red Line (Bangkok) - Wikipedia (Phase I trial 2 August 2021, commercial 29 November 2021; stations RN01-RN10)",
  published_at: null,
};
const REF_LIGHT_WIKI: SourceRef = {
  url: "https://en.wikipedia.org/wiki/Light_Red_Line_(Bangkok)",
  title:
    "Light Red Line (Bangkok) - Wikipedia (Phase I trial 2 August 2021, commercial 29 November 2021; stations RW01-RW06)",
  published_at: null,
};
const REF_BANG_BAMRU: SourceRef = {
  url: "https://en.wikipedia.org/wiki/Bang_Bamru_railway_station",
  title:
    "Bang Bamru railway station - Wikipedia (code RW05, opened 2 August 2021)",
  published_at: null,
};
const REF_KTA_WIKI: SourceRef = {
  url: "https://en.wikipedia.org/wiki/Krung_Thep_Aphiwat_Central_Terminal",
  title:
    "Krung Thep Aphiwat Central Terminal - Wikipedia (codes RN01 and RW01; Red Line trial from the station on 2 August 2021)",
  published_at: null,
};
const REF_KTA_RENAME: SourceRef = {
  url: "https://www.thaipbsworld.com/around-thailand/thai-king-renames-bangkoks-main-rail-station-to-krung-thep-aphiwat-central-terminal",
  title:
    "Thai PBS World - Thai King renames Bangkok's main rail station to Krung Thep Aphiwat Central Terminal (new name presented to SRT in September 2022; article 2 January 2023)",
  published_at: "2023-01-02",
};
const REF_ARL_OPEN: SourceRef = {
  url: "https://www.railwaygazette.com/urban/2010/08/24/bangkok-suvarnabhumi-airport-rail-link-opens/",
  title:
    "Railway Gazette - Bangkok Suvarnabhumi airport rail link opens (commercial operations from 23 August 2010; free SRT trial service since 1 June)",
  published_at: "2010-08-24",
};
const REF_ARL_WIKI: SourceRef = {
  url: "https://en.wikipedia.org/wiki/Airport_Rail_Link_(Bangkok)",
  title:
    "Airport Rail Link (Bangkok) - Wikipedia (opened 23 August 2010; stations A1-A8)",
  published_at: null,
};

const RED_TRIAL_REFS = [REF_RED_TRIAL, REF_DARK_WIKI];
const RED_OPEN_REFS_DARK = [REF_RED_COMMERCIAL, REF_DARK_WIKI];
const RED_OPEN_REFS_LIGHT = [REF_RED_COMMERCIAL, REF_LIGHT_WIKI];

type SeedStation = {
  id: string;
  osm_ref?: string;
  osm_name?: string;
  structure: Station["structure"];
  /** Trial and opening dates of the segment/station on this seed's own line. */
  trial_run: { date: string; source_refs: SourceRef[] };
  opened: { date: string; source_refs: SourceRef[] };
};

type SeedLine = {
  line: Line;
  seeds: SeedStation[];
  namePrefixes: string[];
};

const dark = (
  id: string,
  osm_name: string,
  structure: Station["structure"] = "elevated",
): SeedStation => ({
  id,
  osm_name,
  structure,
  trial_run: { date: OPENED_TRIAL, source_refs: RED_TRIAL_REFS },
  opened: { date: OPENED_COMMERCIAL, source_refs: RED_OPEN_REFS_DARK },
});

const light = (
  id: string,
  osm_name: string,
  extraRefs: SourceRef[] = [],
): SeedStation => ({
  id,
  osm_name,
  structure: "elevated",
  trial_run: {
    date: OPENED_TRIAL,
    source_refs: [REF_RED_TRIAL, REF_LIGHT_WIKI, ...extraRefs],
  },
  opened: { date: OPENED_COMMERCIAL, source_refs: RED_OPEN_REFS_LIGHT },
});

const arl = (
  id: string,
  osm_ref: string,
  structure: Station["structure"] = "elevated",
): SeedStation => ({
  id,
  osm_ref,
  structure,
  trial_run: { date: "2010-06-01", source_refs: [REF_ARL_OPEN] },
  opened: { date: "2010-08-23", source_refs: [REF_ARL_OPEN, REF_ARL_WIKI] },
});

// Krung Thep Aphiwat (formerly Bang Sue Grand): ONE station, two codes, one
// window per Red line - the same model as Tao Poon in seed-2019. The Dark Red
// code is the stable id; RW01 is carried in code_history.
const KTA_NAME = "กรุงเทพอภิวัฒน์";
const KTA: SeedStation = dark("RN01", KTA_NAME);
const KTA_LIGHT: SeedStation = light("RN01", KTA_NAME, [REF_KTA_WIKI]);

const DARK_RED: SeedLine = {
  line: {
    id: "SRT_DARKRED",
    operator: "SRTET",
    name_th: "รถไฟฟ้าชานเมือง สายสีแดงเข้ม",
    name_en: "SRT Dark Red Line",
    color_hex: "#B5191E",
    milestones: [
      {
        date: OPENED_TRIAL,
        date_precision: "exact",
        event: "trial_run",
        source_refs: RED_TRIAL_REFS,
      },
      {
        date: OPENED_COMMERCIAL,
        date_precision: "exact",
        event: "opened",
        source_refs: RED_OPEN_REFS_DARK,
      },
    ],
    confidence: "high",
    last_verified_at: "2026-10-06",
  },
  namePrefixes: ["SRT Dark Red Line"],
  seeds: [
    { ...KTA, osm_name: KTA_NAME },
    dark("RN02", "จตุจักร"),
    dark("RN03", "วัดเสมียนนารี"),
    dark("RN04", "บางเขน"),
    dark("RN05", "ทุ่งสองห้อง"),
    dark("RN06", "หลักสี่"),
    dark("RN07", "การเคหะ"),
    dark("RN08", "ดอนเมือง"),
    dark("RN09", "หลักหก (ม.รังสิต)"),
    dark("RN10", "รังสิต"),
  ],
};

const LIGHT_RED: SeedLine = {
  line: {
    id: "SRT_LIGHTRED",
    operator: "SRTET",
    name_th: "รถไฟฟ้าชานเมือง สายสีแดงอ่อน",
    name_en: "SRT Light Red Line",
    color_hex: "#FC5353",
    milestones: [
      {
        date: OPENED_TRIAL,
        date_precision: "exact",
        event: "trial_run",
        source_refs: [REF_RED_TRIAL, REF_LIGHT_WIKI],
      },
      {
        date: OPENED_COMMERCIAL,
        date_precision: "exact",
        event: "opened",
        source_refs: RED_OPEN_REFS_LIGHT,
      },
    ],
    confidence: "high",
    last_verified_at: "2026-10-06",
  },
  namePrefixes: ["SRT Light Red Line"],
  seeds: [
    { ...KTA_LIGHT, osm_name: KTA_NAME },
    light("RW02", "บางซ่อน"),
    light("RW05", "บางบำหรุ", [REF_BANG_BAMRU]),
    light("RW06", "ชุมทางตลิ่งชัน"),
  ],
};

const AIRPORT_LINK: SeedLine = {
  line: {
    id: "ARL_AIRPORT",
    operator: "SRTET",
    name_th: "รถไฟฟ้าเชื่อมท่าอากาศยานสุวรรณภูมิ",
    name_en: "Airport Rail Link",
    color_hex: "#59191F",
    milestones: [
      {
        date: "2010-06-01",
        date_precision: "exact",
        event: "trial_run",
        source_refs: [REF_ARL_OPEN],
      },
      {
        date: "2010-08-23",
        date_precision: "exact",
        event: "opened",
        source_refs: [REF_ARL_OPEN, REF_ARL_WIKI],
      },
    ],
    confidence: "high",
    last_verified_at: "2026-10-06",
  },
  namePrefixes: ["Airport Rail Link"],
  seeds: [
    arl("A1", "A1", "underground"),
    arl("A2", "A2"),
    arl("A3", "A3"),
    arl("A4", "A4"),
    arl("A5", "A5"),
    arl("A6", "A6"),
    arl("A7", "A7"),
    arl("A8", "A8"),
  ],
};

const SEED_LINES = [DARK_RED, LIGHT_RED, AIRPORT_LINK];

function loadOsm(): OsmElement[] {
  const raw = JSON.parse(
    readFileSync(
      new URL("../../data/source/osm-raw-train.json", import.meta.url),
      "utf-8",
    ),
  ) as { elements: OsmElement[] };
  return raw.elements;
}

function milestonesOf(
  seed: SeedStation,
  line: string | undefined,
): Milestone[] {
  return [
    {
      date: seed.trial_run.date,
      date_precision: "exact",
      event: "trial_run",
      line,
      source_refs: seed.trial_run.source_refs,
    },
    {
      date: seed.opened.date,
      date_precision: "exact",
      event: "opened",
      line,
      source_refs: seed.opened.source_refs,
    },
  ];
}

function buildStation(
  seed: SeedStation,
  lineId: string,
  elements: OsmElement[],
): Station {
  const { lat, lon, name_th, name_en } = resolveCoords(seed, elements, seed.id);
  return {
    id: seed.id,
    name_th,
    name_en,
    code_history: [{ code: seed.id, from: seed.opened.date, to: null }],
    interchange_group: null,
    structure: seed.structure,
    accessible: resolveAccessible(seed, elements),
    coords: { geo: { lat, lon } },
    validity: [{ line: lineId, from: seed.opened.date, to: null }],
    milestones: milestonesOf(seed, undefined),
    status: "operational",
    confidence: "medium",
    last_verified_at: "2026-10-06",
  };
}

/** The shared station: both Red lines, two codes, plus the dated rename. */
function buildSharedStation(elements: OsmElement[]): Station {
  const base = buildStation(KTA, DARK_RED.line.id, elements);
  return {
    ...base,
    code_history: [
      { code: "RN01", from: OPENED_COMMERCIAL, to: null },
      { code: "RW01", from: OPENED_COMMERCIAL, to: null },
    ],
    validity: [
      { line: DARK_RED.line.id, from: OPENED_COMMERCIAL, to: null },
      { line: LIGHT_RED.line.id, from: OPENED_COMMERCIAL, to: null },
    ],
    milestones: [
      ...milestonesOf(KTA, DARK_RED.line.id),
      ...milestonesOf(KTA_LIGHT, LIGHT_RED.line.id),
      {
        // The exact day is not in the fetched source; month precision keeps
        // the claim honest. Earlier sources call the station Bang Sue Grand.
        date: "2022-09-01",
        date_precision: "month",
        event: "renamed",
        source_refs: [REF_KTA_RENAME],
      },
    ],
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

function buildSegments(
  seedLine: SeedLine,
  stationById: Map<string, Station>,
  elements: OsmElement[],
): { segments: Segment[]; traced: number } {
  const nodes = new Map(
    elements.filter((e) => e.type === "node").map((e) => [e.id, e]),
  );
  const candidates = traceCandidates(elements, seedLine.namePrefixes, nodes);
  let traced = 0;
  const segments = seedLine.seeds.slice(0, -1).map((from, i) => {
    const to = seedLine.seeds[i + 1]!;
    const fromStation = stationById.get(from.id)!;
    const toStation = stationById.get(to.id)!;
    const trace = chooseTrace(
      candidates,
      nodes,
      [fromStation.coords.geo.lon, fromStation.coords.geo.lat],
      [toStation.coords.geo.lon, toStation.coords.geo.lat],
    );
    if (trace !== null) traced++;
    // A segment opens when its destination station opens; the milestones
    // carry the destination's own dates and sources.
    return {
      id: `${from.id}__${to.id}`,
      line: seedLine.line.id,
      from_station: from.id,
      to_station: to.id,
      geometry:
        trace === null
          ? null
          : { type: "LineString" as const, coordinates: trace.coordinates },
      geometry_source: (trace === null ? "straight" : "osm") as
        "straight" | "osm",
      osm_way_refs: trace?.wayRefs ?? [],
      validity: [{ from: to.opened.date, to: null }],
      milestones: milestonesOf(to, undefined),
      confidence: "medium" as const,
      last_verified_at: "2026-10-06",
    };
  });
  return { segments, traced };
}

function main() {
  const elements = loadOsm();
  const sourceDir = new URL("../../data/source/", import.meta.url);

  const stations = new Map<string, Station>();
  for (const seedLine of SEED_LINES) {
    for (const seed of seedLine.seeds) {
      if (stations.has(seed.id)) continue;
      stations.set(
        seed.id,
        seed.id === KTA.id
          ? buildSharedStation(elements)
          : buildStation(seed, seedLine.line.id, elements),
      );
    }
  }

  const segments: Segment[] = [];
  let traced = 0;
  for (const seedLine of SEED_LINES) {
    const result = buildSegments(seedLine, stations, elements);
    segments.push(...result.segments);
    traced += result.traced;
  }

  for (const [dir, entities] of [
    ["stations", [...stations.values()]],
    ["lines", SEED_LINES.map((l) => l.line)],
    ["segments", segments],
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
    `Seeded ${stations.size} stations, ${SEED_LINES.length} lines, ` +
      `${segments.length} segments (${traced} traced from OSM, ${segments.length - traced} straight-line fallback)`,
  );
}

main();

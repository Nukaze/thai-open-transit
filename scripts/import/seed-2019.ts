// scripts/import/seed-2019.ts
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
 * Extends the network to its 2019-12-31 state: every BTS Sukhumvit/Silom
 * extension that had commercial service running by then, plus the MRT Blue
 * and Purple lines (Blue's original 2004 section, its 2017 single-stop
 * extension to Tao Poon, and its 2019 southern extension - NOT the Bang
 * Sue-Tha Phra northern loop, whose commercial service did not start until
 * 30 March 2020, after this snapshot's cutoff).
 *
 * This script is the sole owner, going forward, of the BTS_SUKHUMVIT and
 * BTS_SILOM Line entities: it restates their complete milestone history
 * (1999 opening + every extension through 2019) rather than patching the
 * file seed-1999.ts wrote. Run seed-1999.ts first, then this script second -
 * running seed-1999.ts again afterward would revert those two Line files to
 * just their 1999 milestone, requiring this script to be re-run to restore
 * the rest of the history. Station and segment ownership does not have this
 * problem: each id is written by exactly one seed script.
 *
 * Geometry and Thai/English names come from data/source/osm-raw.json
 * (CLAUDE.md 2.6). Opening dates and station-code assignments are curated
 * below from independent secondary sources, because OSM's `ref` tags mostly
 * reflect only the current-day map, not which stations existed - or what
 * they were coded - at any past date.
 */

type SeedStation = {
  /** Stable id. */
  id: string;
  /** OSM `ref` to look the node up by; omitted when matched on name instead. */
  osm_ref?: string;
  /** Exact OSM `name` (Thai) for stations mapped only as stop_positions. */
  osm_name?: string;
  interchange_group?: string;
  structure: Station["structure"];
  /** This station's own opened milestone; carry-over boundary stations from
   * an earlier era (N8, E9, S6, BL10-as-Tao-Poon's Purple half) omit this -
   * they are listed only so segments can chain to them, not to be rewritten. */
  opened?: { date: string; source_refs: SourceRef[] };
  /** Trial service predates commercial `opened` for the 2019 MRT southern
   * extension (CLAUDE.md 5: trial_run and opened are distinct and both
   * matter). Segments in that batch use the same pair. */
  trial_run?: { date: string; source_refs: SourceRef[] };
  /** Extra code_history entries beyond the default `[{code:id,from:opened,to:null}]`
   * - only Tao Poon needs this, carrying both PP16 (2016) and BL10 (2017) as
   * simultaneously valid codes from two operators. */
  code_history?: Station["code_history"];
  /** Extra validity entries beyond the single line this array belongs to -
   * only Tao Poon needs this (MRT_PURPLE and MRT_BLUE both), each with its
   * own citation rather than borrowing `opened.source_refs`. */
  extraValidity?: { line: string; from: string; source_refs: SourceRef[] }[];
};

const WIKI_SUKHUMVIT_NORTH_1: SourceRef = {
  url: "https://www.railjournal.com/passenger/metros/bangkok-sukhumvit-line-extension-inaugurated/",
  title:
    "Bangkok Sukhumvit Line extension inaugurated - Mo Chit to Ha Yaek Lat Phrao, 9 August 2019",
  published_at: null,
};
const WIKI_SUKHUMVIT_NORTH_2: SourceRef = {
  url: "https://en.wikipedia.org/wiki/Ha_Yaek_Lat_Phrao_BTS_station",
  title:
    "Ha Yaek Lat Phrao BTS station - Wikipedia (4-station extension to Kasetsart University, 4 December 2019)",
  published_at: null,
};
const WIKI_SUKHUMVIT_BEARING: SourceRef = {
  url: "https://en.wikipedia.org/wiki/Bearing_BTS_station",
  title:
    "Bearing BTS station - Wikipedia (On Nut-Bearing extension opened 12 August 2011)",
  published_at: null,
};
const WIKI_SUKHUMVIT_SAMRONG: SourceRef = {
  url: "https://en.wikipedia.org/wiki/Samrong_BTS_station",
  title: "Samrong BTS station - Wikipedia (opened 3 April 2017)",
  published_at: null,
};
const WIKI_SUKHUMVIT_SAMUT_PRAKAN: SourceRef = {
  url: "https://en.wikipedia.org/wiki/Kheha_BTS_station",
  title:
    "Kheha BTS station - Wikipedia (Bearing-Samut Prakan 8-station extension opened 6 December 2018)",
  published_at: null,
};
const WIKI_SILOM_WONGWIAN_YAI: SourceRef = {
  url: "https://en.wikipedia.org/wiki/Wongwian_Yai_BTS_station",
  title: "Wongwian Yai BTS station - Wikipedia (opened 15 May 2009)",
  published_at: null,
};
const WIKI_SILOM_TALAT_PHLU: SourceRef = {
  url: "https://en.wikipedia.org/wiki/Silom_Line",
  title:
    "Silom Line - Wikipedia (Wongwian Yai-Talat Phlu opened 14 February 2013)",
  published_at: null,
};
const WIKI_SILOM_BANG_WA: SourceRef = {
  url: "https://en.wikipedia.org/wiki/Bang_Wa_station",
  title:
    "Bang Wa station - Wikipedia (Talat Phlu-Bang Wa opened 5 December 2013)",
  published_at: null,
};
const WIKI_BLUE_ORIGINAL: SourceRef = {
  url: "https://en.wikipedia.org/wiki/MRT_Blue_Line",
  title: "MRT Blue Line - Wikipedia (Hua Lamphong-Bang Sue opened 3 July 2004)",
  published_at: null,
};
const WIKI_BLUE_TAO_POON: SourceRef = {
  url: "https://en.wikipedia.org/wiki/Tao_Poon_MRT_station",
  title:
    "Tao Poon MRT station - Wikipedia (Bang Sue-Tao Poon extension opened 11 August 2017)",
  published_at: null,
};
const WIKI_BLUE_SOUTH_EXT: SourceRef = {
  url: "https://en.wikipedia.org/wiki/MRT_Blue_Line",
  title:
    "MRT Blue Line - Wikipedia (Hua Lamphong-Lak Song extension: trial 29 July 2019, commercial 29 September 2019)",
  published_at: null,
};
const WIKI_PURPLE: SourceRef = {
  url: "https://en.wikipedia.org/wiki/Purple_Line_(Bangkok)",
  title:
    "Purple Line (Bangkok) - Wikipedia (Khlong Bang Phai-Tao Poon opened 6 August 2016)",
  published_at: null,
};

const opened = (date: string, ...refs: SourceRef[]) => ({
  date,
  source_refs: refs,
});

// --- BTS Sukhumvit: north extension (Mo Chit onward) -----------------------
const SUKHUMVIT_NORTH_2019: SeedStation[] = [
  { id: "N8", osm_ref: "N8", structure: "elevated" }, // 1999 boundary, not rewritten
  {
    id: "N9",
    osm_ref: "N9",
    structure: "elevated",
    opened: opened("2019-08-09", WIKI_SUKHUMVIT_NORTH_1),
  },
  {
    id: "N10",
    osm_name: "พหลโยธิน 24",
    structure: "elevated",
    opened: opened("2019-12-04", WIKI_SUKHUMVIT_NORTH_2),
  },
  {
    id: "N11",
    osm_name: "รัชโยธิน",
    structure: "elevated",
    opened: opened("2019-12-04", WIKI_SUKHUMVIT_NORTH_2),
  },
  {
    id: "N12",
    osm_name: "เสนานิคม",
    structure: "elevated",
    opened: opened("2019-12-04", WIKI_SUKHUMVIT_NORTH_2),
  },
  {
    id: "N13",
    osm_name: "มหาวิทยาลัยเกษตรศาสตร์",
    structure: "elevated",
    opened: opened("2019-12-04", WIKI_SUKHUMVIT_NORTH_2),
  },
];

// --- BTS Sukhumvit: south extension (On Nut to Kheha) -----------------------
const SUKHUMVIT_SOUTH_2019: SeedStation[] = [
  { id: "E9", osm_ref: "E9", structure: "elevated" }, // 1999 boundary, not rewritten
  {
    id: "E10",
    osm_ref: "E10",
    structure: "elevated",
    opened: opened("2011-08-12", WIKI_SUKHUMVIT_BEARING),
  },
  {
    id: "E11",
    osm_ref: "E11",
    structure: "elevated",
    opened: opened("2011-08-12", WIKI_SUKHUMVIT_BEARING),
  },
  {
    id: "E12",
    osm_ref: "E12",
    structure: "elevated",
    opened: opened("2011-08-12", WIKI_SUKHUMVIT_BEARING),
  },
  {
    id: "E13",
    osm_ref: "E13",
    structure: "elevated",
    opened: opened("2011-08-12", WIKI_SUKHUMVIT_BEARING),
  },
  {
    id: "E14",
    osm_ref: "E14",
    structure: "elevated",
    opened: opened("2011-08-12", WIKI_SUKHUMVIT_BEARING),
  },
  {
    id: "E15",
    osm_ref: "E15",
    structure: "elevated",
    opened: opened("2017-04-03", WIKI_SUKHUMVIT_SAMRONG),
  },
  {
    id: "E16",
    osm_ref: "E16",
    structure: "elevated",
    opened: opened("2018-12-06", WIKI_SUKHUMVIT_SAMUT_PRAKAN),
  },
  {
    id: "E17",
    osm_ref: "E17",
    structure: "elevated",
    opened: opened("2018-12-06", WIKI_SUKHUMVIT_SAMUT_PRAKAN),
  },
  {
    id: "E18",
    osm_ref: "E18",
    structure: "elevated",
    opened: opened("2018-12-06", WIKI_SUKHUMVIT_SAMUT_PRAKAN),
  },
  {
    id: "E19",
    osm_ref: "E19",
    structure: "elevated",
    opened: opened("2018-12-06", WIKI_SUKHUMVIT_SAMUT_PRAKAN),
  },
  {
    id: "E20",
    osm_ref: "E20",
    structure: "elevated",
    opened: opened("2018-12-06", WIKI_SUKHUMVIT_SAMUT_PRAKAN),
  },
  {
    id: "E21",
    osm_ref: "E21",
    structure: "elevated",
    opened: opened("2018-12-06", WIKI_SUKHUMVIT_SAMUT_PRAKAN),
  },
  {
    id: "E22",
    osm_ref: "E22",
    structure: "elevated",
    opened: opened("2018-12-06", WIKI_SUKHUMVIT_SAMUT_PRAKAN),
  },
  {
    id: "E23",
    osm_ref: "E23",
    structure: "elevated",
    opened: opened("2018-12-06", WIKI_SUKHUMVIT_SAMUT_PRAKAN),
  },
];

// --- BTS Silom: south extension (Saphan Taksin to Bang Wa) ------------------
const SILOM_SOUTH_2019: SeedStation[] = [
  { id: "S6", osm_ref: "S6", structure: "elevated" }, // 1999 boundary, not rewritten
  {
    id: "S7",
    osm_name: "กรุงธนบุรี",
    structure: "elevated",
    opened: opened("2009-05-15", WIKI_SILOM_WONGWIAN_YAI),
  },
  {
    id: "S8",
    osm_name: "วงเวียนใหญ่",
    structure: "elevated",
    opened: opened("2009-05-15", WIKI_SILOM_WONGWIAN_YAI),
  },
  {
    id: "S9",
    osm_name: "โพธิ์นิมิตร",
    structure: "elevated",
    opened: opened("2013-02-14", WIKI_SILOM_TALAT_PHLU),
  },
  {
    id: "S10",
    osm_name: "ตลาดพลู",
    structure: "elevated",
    opened: opened("2013-02-14", WIKI_SILOM_TALAT_PHLU),
  },
  {
    id: "S11",
    osm_name: "วุฒากาศ",
    structure: "elevated",
    opened: opened("2013-12-05", WIKI_SILOM_BANG_WA),
  },
  {
    id: "S12",
    osm_ref: "S12",
    structure: "elevated",
    interchange_group: "BANG_WA",
    opened: opened("2013-12-05", WIKI_SILOM_BANG_WA),
  },
];

// --- MRT Blue Line: Tao Poon to Lak Song (2019 scope) -----------------------
// Order is the real chain: Tao Poon at the north end, then the 2004 original
// section, then the 2019 southern extension. Excludes BL01-BL09 (the
// Bang Sue-Tha Phra northern loop) - commercial service there did not begin
// until 30 March 2020, after this snapshot's cutoff.
const BLUE_2019: SeedStation[] = [
  {
    id: "BL10",
    osm_ref: "BL10",
    osm_name: "เตาปูน",
    structure: "elevated",
    interchange_group: "TAO_POON",
    // Tao Poon opened for the Purple Line in 2016; the Blue Line connection
    // followed in 2017. Both codes are independently real and simultaneously
    // valid, so code_history carries both instead of treating one as a
    // renumbering of the other.
    code_history: [
      { code: "PP16", from: "2016-08-06", to: null },
      { code: "BL10", from: "2017-08-11", to: null },
    ],
    opened: opened("2017-08-11", WIKI_BLUE_TAO_POON),
    extraValidity: [
      { line: "MRT_PURPLE", from: "2016-08-06", source_refs: [WIKI_PURPLE] },
    ],
  },
  {
    id: "BL11",
    osm_name: "บางซื่อ",
    structure: "underground",
    opened: opened("2004-07-03", WIKI_BLUE_ORIGINAL),
  },
  {
    id: "BL12",
    osm_ref: "BL12",
    structure: "underground",
    opened: opened("2004-07-03", WIKI_BLUE_ORIGINAL),
  },
  {
    id: "BL13",
    osm_ref: "BL13",
    structure: "underground",
    interchange_group: "MOCHIT_CHATUCHAK",
    opened: opened("2004-07-03", WIKI_BLUE_ORIGINAL),
  },
  {
    id: "BL14",
    osm_ref: "BL14",
    structure: "underground",
    opened: opened("2004-07-03", WIKI_BLUE_ORIGINAL),
  },
  {
    id: "BL15",
    osm_ref: "BL15",
    structure: "underground",
    opened: opened("2004-07-03", WIKI_BLUE_ORIGINAL),
  },
  {
    id: "BL16",
    osm_ref: "BL16",
    structure: "underground",
    opened: opened("2004-07-03", WIKI_BLUE_ORIGINAL),
  },
  {
    id: "BL17",
    osm_ref: "BL17",
    structure: "underground",
    opened: opened("2004-07-03", WIKI_BLUE_ORIGINAL),
  },
  {
    id: "BL18",
    osm_ref: "BL18",
    structure: "underground",
    opened: opened("2004-07-03", WIKI_BLUE_ORIGINAL),
  },
  {
    id: "BL19",
    osm_name: "ศูนย์วัฒนธรรมแห่งประเทศไทย",
    structure: "underground",
    opened: opened("2004-07-03", WIKI_BLUE_ORIGINAL),
  },
  {
    id: "BL20",
    osm_ref: "BL20",
    structure: "underground",
    opened: opened("2004-07-03", WIKI_BLUE_ORIGINAL),
  },
  {
    id: "BL21",
    osm_name: "เพชรบุรี",
    structure: "underground",
    opened: opened("2004-07-03", WIKI_BLUE_ORIGINAL),
  },
  {
    id: "BL22",
    osm_name: "สุขุมวิท",
    structure: "underground",
    interchange_group: "ASOK_SUKHUMVIT",
    opened: opened("2004-07-03", WIKI_BLUE_ORIGINAL),
  },
  {
    id: "BL23",
    osm_name: "ศูนย์การประชุมแห่งชาติสิริกิติ์",
    structure: "underground",
    opened: opened("2004-07-03", WIKI_BLUE_ORIGINAL),
  },
  {
    id: "BL24",
    osm_name: "คลองเตย",
    structure: "underground",
    opened: opened("2004-07-03", WIKI_BLUE_ORIGINAL),
  },
  {
    id: "BL25",
    osm_name: "ลุมพินี",
    structure: "underground",
    opened: opened("2004-07-03", WIKI_BLUE_ORIGINAL),
  },
  {
    id: "BL26",
    osm_name: "สีลม",
    structure: "underground",
    interchange_group: "SALA_DAENG_SILOM",
    opened: opened("2004-07-03", WIKI_BLUE_ORIGINAL),
  },
  {
    id: "BL27",
    osm_name: "สามย่าน",
    structure: "underground",
    opened: opened("2004-07-03", WIKI_BLUE_ORIGINAL),
  },
  {
    id: "BL28",
    osm_name: "หัวลำโพง",
    structure: "underground",
    opened: opened("2004-07-03", WIKI_BLUE_ORIGINAL),
  },
  {
    id: "BL29",
    osm_name: "วัดมังกร",
    structure: "underground",
    opened: opened("2019-09-29", WIKI_BLUE_SOUTH_EXT),
    trial_run: opened("2019-07-29", WIKI_BLUE_SOUTH_EXT),
  },
  {
    id: "BL30",
    osm_name: "สามยอด",
    structure: "underground",
    opened: opened("2019-09-29", WIKI_BLUE_SOUTH_EXT),
    trial_run: opened("2019-07-29", WIKI_BLUE_SOUTH_EXT),
  },
  {
    id: "BL31",
    osm_name: "สนามไชย",
    structure: "underground",
    opened: opened("2019-09-29", WIKI_BLUE_SOUTH_EXT),
    trial_run: opened("2019-07-29", WIKI_BLUE_SOUTH_EXT),
  },
  {
    id: "BL32",
    osm_name: "อิสรภาพ",
    structure: "underground",
    opened: opened("2019-09-29", WIKI_BLUE_SOUTH_EXT),
    trial_run: opened("2019-07-29", WIKI_BLUE_SOUTH_EXT),
  },
  {
    id: "BL33",
    osm_name: "บางไผ่",
    structure: "elevated",
    opened: opened("2019-09-29", WIKI_BLUE_SOUTH_EXT),
    trial_run: opened("2019-07-29", WIKI_BLUE_SOUTH_EXT),
  },
  {
    id: "BL34",
    osm_ref: "BL34",
    osm_name: "บางหว้า",
    structure: "elevated",
    interchange_group: "BANG_WA",
    opened: opened("2019-09-29", WIKI_BLUE_SOUTH_EXT),
    trial_run: opened("2019-07-29", WIKI_BLUE_SOUTH_EXT),
  },
  {
    id: "BL35",
    osm_name: "เพชรเกษม 48",
    structure: "elevated",
    opened: opened("2019-09-29", WIKI_BLUE_SOUTH_EXT),
    trial_run: opened("2019-07-29", WIKI_BLUE_SOUTH_EXT),
  },
  {
    id: "BL36",
    osm_name: "ภาษีเจริญ",
    structure: "elevated",
    opened: opened("2019-09-29", WIKI_BLUE_SOUTH_EXT),
    trial_run: opened("2019-07-29", WIKI_BLUE_SOUTH_EXT),
  },
  {
    id: "BL37",
    osm_name: "บางแค",
    structure: "elevated",
    opened: opened("2019-09-29", WIKI_BLUE_SOUTH_EXT),
    trial_run: opened("2019-07-29", WIKI_BLUE_SOUTH_EXT),
  },
  {
    id: "BL38",
    osm_name: "หลักสอง",
    structure: "elevated",
    opened: opened("2019-09-29", WIKI_BLUE_SOUTH_EXT),
    trial_run: opened("2019-07-29", WIKI_BLUE_SOUTH_EXT),
  },
];

// --- MRT Purple Line: Khlong Bang Phai to Tao Poon --------------------------
// BL10 above stands in for PP16 (Tao Poon) - same physical station, listed
// once. See its `extraValidity`/`code_history` for the Purple Line side.
const PURPLE_2019: SeedStation[] = [
  {
    id: "PP01",
    osm_name: "คลองบางไผ่",
    structure: "elevated",
    opened: opened("2016-08-06", WIKI_PURPLE),
  },
  {
    id: "PP02",
    osm_name: "ตลาดบางใหญ่",
    structure: "elevated",
    opened: opened("2016-08-06", WIKI_PURPLE),
  },
  {
    id: "PP03",
    osm_name: "สามแยกบางใหญ่",
    structure: "elevated",
    opened: opened("2016-08-06", WIKI_PURPLE),
  },
  {
    id: "PP04",
    osm_name: "บางพลู",
    structure: "elevated",
    opened: opened("2016-08-06", WIKI_PURPLE),
  },
  {
    id: "PP05",
    osm_name: "บางรักใหญ่",
    structure: "elevated",
    opened: opened("2016-08-06", WIKI_PURPLE),
  },
  {
    id: "PP06",
    osm_name: "บางรักน้อยท่าอิฐ",
    structure: "elevated",
    opened: opened("2016-08-06", WIKI_PURPLE),
  },
  {
    id: "PP07",
    osm_name: "ไทรม้า",
    structure: "elevated",
    opened: opened("2016-08-06", WIKI_PURPLE),
  },
  {
    id: "PP08",
    osm_name: "สะพานพระนั่งเกล้า",
    structure: "elevated",
    opened: opened("2016-08-06", WIKI_PURPLE),
  },
  {
    id: "PP09",
    osm_name: "แยกนนทบุรี 1",
    structure: "elevated",
    opened: opened("2016-08-06", WIKI_PURPLE),
  },
  {
    id: "PP10",
    osm_name: "บางกระสอ",
    structure: "elevated",
    opened: opened("2016-08-06", WIKI_PURPLE),
  },
  {
    id: "PP11",
    osm_name: "ศูนย์ราชการนนทบุรี",
    structure: "elevated",
    opened: opened("2016-08-06", WIKI_PURPLE),
  },
  {
    id: "PP12",
    osm_name: "กระทรวงสาธารณสุข",
    structure: "elevated",
    opened: opened("2016-08-06", WIKI_PURPLE),
  },
  {
    id: "PP13",
    osm_name: "แยกติวานนท์",
    structure: "elevated",
    opened: opened("2016-08-06", WIKI_PURPLE),
  },
  {
    id: "PP14",
    osm_name: "วงศ์สว่าง",
    structure: "elevated",
    opened: opened("2016-08-06", WIKI_PURPLE),
  },
  {
    id: "PP15",
    osm_name: "บางซ่อน",
    structure: "elevated",
    opened: opened("2016-08-06", WIKI_PURPLE),
  },
  {
    id: "BL10",
    osm_ref: "BL10",
    osm_name: "เตาปูน",
    structure: "elevated",
    // Tao Poon is fully defined in BLUE_2019 above and not rewritten here
    // (skipWriteIds); `opened` is repeated so buildSegments can date the
    // PP15__BL10 segment by the Purple side's own 2016 opening.
    opened: opened("2016-08-06", WIKI_PURPLE),
  },
];

const BTS_SUKHUMVIT_LINE: Line = {
  id: "BTS_SUKHUMVIT",
  operator: "BTS",
  name_th: "รถไฟฟ้าบีทีเอส สายสุขุมวิท",
  name_en: "BTS Sukhumvit Line",
  color_hex: "#65B724",
  milestones: [
    {
      date: "1999-12-05",
      date_precision: "exact",
      event: "opened",
      source_refs: [
        {
          url: "https://www.bts.co.th/eng/info/info-history.html",
          title: "BTS Skytrain - History (Bangkok Mass Transit System PCL)",
          published_at: null,
        },
      ],
    },
    {
      date: "2011-08-12",
      date_precision: "exact",
      event: "extended",
      source_refs: [WIKI_SUKHUMVIT_BEARING],
    },
    {
      date: "2017-04-03",
      date_precision: "exact",
      event: "extended",
      source_refs: [WIKI_SUKHUMVIT_SAMRONG],
    },
    {
      date: "2018-12-06",
      date_precision: "exact",
      event: "extended",
      source_refs: [WIKI_SUKHUMVIT_SAMUT_PRAKAN],
    },
    {
      date: "2019-08-09",
      date_precision: "exact",
      event: "extended",
      source_refs: [WIKI_SUKHUMVIT_NORTH_1],
    },
    {
      date: "2019-12-04",
      date_precision: "exact",
      event: "extended",
      source_refs: [WIKI_SUKHUMVIT_NORTH_2],
    },
  ],
  confidence: "high",
  last_verified_at: "2026-09-01",
};

const BTS_SILOM_LINE: Line = {
  id: "BTS_SILOM",
  operator: "BTS",
  name_th: "รถไฟฟ้าบีทีเอส สายสีลม",
  name_en: "BTS Silom Line",
  color_hex: "#02817D",
  milestones: [
    {
      date: "1999-12-05",
      date_precision: "exact",
      event: "opened",
      source_refs: [
        {
          url: "https://www.bts.co.th/eng/info/info-history.html",
          title: "BTS Skytrain - History (Bangkok Mass Transit System PCL)",
          published_at: null,
        },
      ],
    },
    {
      date: "2009-05-15",
      date_precision: "exact",
      event: "extended",
      source_refs: [WIKI_SILOM_WONGWIAN_YAI],
    },
    {
      date: "2013-02-14",
      date_precision: "exact",
      event: "extended",
      source_refs: [WIKI_SILOM_TALAT_PHLU],
    },
    {
      date: "2013-12-05",
      date_precision: "exact",
      event: "extended",
      source_refs: [WIKI_SILOM_BANG_WA],
    },
  ],
  confidence: "high",
  last_verified_at: "2026-09-01",
};

const MRT_BLUE_LINE: Line = {
  id: "MRT_BLUE",
  operator: "BEM",
  name_th: "รถไฟฟ้ามหานคร สายเฉลิมรัชมงคล",
  name_en: "MRT Blue Line",
  color_hex: "#1E3A8A",
  milestones: [
    {
      date: "2004-07-03",
      date_precision: "exact",
      event: "opened",
      source_refs: [WIKI_BLUE_ORIGINAL],
    },
    {
      date: "2017-08-11",
      date_precision: "exact",
      event: "extended",
      source_refs: [WIKI_BLUE_TAO_POON],
    },
    {
      date: "2019-07-29",
      date_precision: "exact",
      event: "trial_run",
      source_refs: [WIKI_BLUE_SOUTH_EXT],
    },
    {
      date: "2019-09-29",
      date_precision: "exact",
      event: "extended",
      source_refs: [WIKI_BLUE_SOUTH_EXT],
    },
  ],
  confidence: "high",
  last_verified_at: "2026-09-01",
};

const MRT_PURPLE_LINE: Line = {
  id: "MRT_PURPLE",
  operator: "MRTA",
  name_th: "รถไฟฟ้ามหานคร สายฉลองรัชธรรม",
  name_en: "MRT Purple Line",
  color_hex: "#7C3AED",
  milestones: [
    {
      date: "2016-08-06",
      date_precision: "exact",
      event: "opened",
      source_refs: [WIKI_PURPLE],
    },
  ],
  confidence: "high",
  last_verified_at: "2026-09-01",
};

const LINES: Line[] = [
  BTS_SUKHUMVIT_LINE,
  BTS_SILOM_LINE,
  MRT_BLUE_LINE,
  MRT_PURPLE_LINE,
];

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
  lineId: string,
  elements: OsmElement[],
): Station {
  const { lat, lon, name_th, name_en } = resolveCoords(seed, elements, seed.id);

  const code_history =
    seed.code_history ??
    (seed.opened
      ? [{ code: seed.id, from: seed.opened.date, to: null }]
      : [{ code: seed.id, from: "1999-12-05", to: null }]); // boundary carry-over; never actually written

  const milestones: Milestone[] = [];
  if (seed.trial_run) {
    milestones.push({
      date: seed.trial_run.date,
      date_precision: "exact",
      event: "trial_run",
      source_refs: seed.trial_run.source_refs,
    });
  }
  if (seed.opened) {
    milestones.push({
      date: seed.opened.date,
      date_precision: "exact",
      event: "opened",
      line: seed.extraValidity ? lineId : undefined,
      source_refs: seed.opened.source_refs,
    });
    // Tao Poon's second opened event, for the line not passed as `lineId`.
    for (const extra of seed.extraValidity ?? []) {
      if (extra.line === lineId) continue;
      milestones.push({
        date: extra.from,
        date_precision: "exact",
        event: "opened",
        line: extra.line,
        source_refs: extra.source_refs,
      });
    }
  }

  const validity: Station["validity"] = [
    { line: lineId, from: seed.opened?.date ?? "1999-12-05", to: null },
    ...(seed.extraValidity ?? [])
      .filter((extra) => extra.line !== lineId)
      .map((extra) => ({ line: extra.line, from: extra.from, to: null })),
  ];

  return {
    id: seed.id,
    name_th,
    name_en,
    code_history,
    interchange_group: seed.interchange_group ?? null,
    structure: seed.structure,
    accessible: resolveAccessible(seed, elements),
    coords: { geo: { lat, lon } },
    validity,
    milestones,
    status: "operational",
    confidence: "medium",
    last_verified_at: "2026-09-01",
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
  lineId: string,
  seeds: SeedStation[],
  stationById: Map<string, Station>,
  elements: OsmElement[],
  namePrefixes: string[],
  milestoneFor: (
    fromId: string,
    toId: string,
  ) => {
    date: string;
    trial_run?: string;
    source_refs: SourceRef[];
  },
): { segments: Segment[]; traced: number } {
  const nodes = new Map(
    elements.filter((e) => e.type === "node").map((e) => [e.id, e]),
  );
  const candidates = traceCandidates(elements, namePrefixes, nodes);

  let traced = 0;
  const segments = seeds.slice(0, -1).map((from, i) => {
    const to = seeds[i + 1]!;
    const fromStation = stationById.get(from.id)!;
    const toStation = stationById.get(to.id)!;
    const m = milestoneFor(from.id, to.id);

    const trace = chooseTrace(
      candidates,
      nodes,
      [fromStation.coords.geo.lon, fromStation.coords.geo.lat],
      [toStation.coords.geo.lon, toStation.coords.geo.lat],
    );
    if (trace !== null) traced++;

    const milestones: Milestone[] = [];
    if (m.trial_run) {
      milestones.push({
        date: m.trial_run,
        date_precision: "exact",
        event: "trial_run",
        source_refs: m.source_refs,
      });
    }
    milestones.push({
      date: m.date,
      date_precision: "exact",
      event: "opened",
      source_refs: m.source_refs,
    });

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
      validity: [{ from: m.date, to: null }],
      milestones,
      confidence: "medium" as const,
      last_verified_at: "2026-09-01",
    };
  });

  return { segments, traced };
}

function main() {
  const elements = loadOsm();
  const sourceDir = new URL("../../data/source/", import.meta.url);

  // (seed list, lineId, whether this seed's first entry is a pre-existing
  // 1999 boundary station that must not be rewritten)
  const groups: {
    seeds: SeedStation[];
    lineId: string;
    namePrefixes: string[];
    skipWriteIds: Set<string>;
  }[] = [
    {
      seeds: SUKHUMVIT_NORTH_2019,
      lineId: "BTS_SUKHUMVIT",
      namePrefixes: ["BTS Sukhumvit Line"],
      skipWriteIds: new Set(["N8"]),
    },
    {
      seeds: SUKHUMVIT_SOUTH_2019,
      lineId: "BTS_SUKHUMVIT",
      namePrefixes: ["BTS Sukhumvit Line"],
      skipWriteIds: new Set(["E9"]),
    },
    {
      seeds: SILOM_SOUTH_2019,
      lineId: "BTS_SILOM",
      namePrefixes: ["BTS Silom Line"],
      skipWriteIds: new Set(["S6"]),
    },
    {
      seeds: BLUE_2019,
      lineId: "MRT_BLUE",
      namePrefixes: ["MRT Blue Line"],
      skipWriteIds: new Set(),
    },
    {
      seeds: PURPLE_2019,
      lineId: "MRT_PURPLE",
      namePrefixes: ["MRT Purple Line"],
      skipWriteIds: new Set(["BL10"]), // written once, by the Blue Line group above
    },
  ];

  const allStations = new Map<string, Station>();
  const stationsToWrite = new Map<string, Station>();
  const allSegments: Segment[] = [];
  let totalTraced = 0;
  let totalSegments = 0;

  for (const group of groups) {
    for (const seed of group.seeds) {
      if (allStations.has(seed.id)) continue; // BL10 seen twice (Blue + Purple)
      const station = buildStation(seed, group.lineId, elements);
      allStations.set(seed.id, station);
      if (!group.skipWriteIds.has(seed.id)) {
        stationsToWrite.set(seed.id, station);
      }
    }
  }

  for (const group of groups) {
    const openedById = new Map(
      group.seeds.filter((s) => s.opened).map((s) => [s.id, s.opened!]),
    );
    const trialById = new Map(
      group.seeds.filter((s) => s.trial_run).map((s) => [s.id, s.trial_run!]),
    );
    const { segments, traced } = buildSegments(
      group.lineId,
      group.seeds,
      allStations,
      elements,
      group.namePrefixes,
      (_fromId, toId) => {
        // A segment opens when its destination station opens - the segment
        // from N8 to N9 exists from the moment N9 (the new station) opens.
        const m = openedById.get(toId)!;
        const trial = trialById.get(toId);
        return {
          date: m.date,
          trial_run: trial?.date,
          source_refs: m.source_refs,
        };
      },
    );
    allSegments.push(...segments);
    totalTraced += traced;
    totalSegments += segments.length;
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
    `Seeded ${stationsToWrite.size} stations, ${LINES.length} lines (2 restated with full history), ` +
      `${totalSegments} segments (${totalTraced} traced from OSM, ${totalSegments - totalTraced} straight-line fallback) ` +
      `for the 2019-12-31 network snapshot`,
  );
}

main();

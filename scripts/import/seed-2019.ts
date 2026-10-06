// scripts/import/seed-2019.ts
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
import {
  resolveCoords,
  resolveAccessible,
  stationCandidates,
} from "./osm-stations";

/**
 * Extends the network from the 1999 seed through 2021: every BTS Sukhumvit/
 * Silom extension, the MRT Blue and Purple lines, and the 2020-2021 additions
 * to the EXISTING lines (the Blue Line's Tao Poon-Tha Phra northern loop, the
 * Sukhumvit north extension to Khu Khot, and the Silom infill station Saint
 * Louis). The file name is historical: it began as the 2019 snapshot and was
 * extended in place rather than split into a second script, because Tha Phra
 * (BL01) and Tao Poon (BL10) each have milestones spanning 2019 and 2020 and
 * must have exactly one writer. Each era is a clearly labelled section below.
 * New LINES (Gold, Pink, Yellow, Red, ARL, Orange) are out of scope here.
 *
 * Ownership contract (every entity id is written by exactly one script):
 *   - seed-1999.ts writes the 1999 stations/segments, and S3__S5 including
 *     its retirement (validity.to = 2021-02-08, see RETIRED_SEGMENTS there).
 *   - This script is the sole owner of the BTS_SUKHUMVIT, BTS_SILOM and
 *     MRT_BLUE Line entities: it restates their complete milestone history
 *     (opening + every extension through 2021) rather than patching the
 *     file seed-1999.ts wrote. It also writes every other station/segment
 *     from 2004 onward, including S4, S3__S4, S4__S5, BL01-BL09 and N14-N24.
 *   Run order: seed-1999.ts, then this script. Never run seed-1999.ts alone
 *   afterward: it would revert those Line files to just their 1999
 *   milestone, requiring this script to be re-run to restore the history.
 *   data/source/ is never cleared by a seed; an entity a seed stops producing
 *   (BL32__BL33, see below) is removed by hand in a reviewed `data:` commit.
 *
 * Tha Phra (BL01) correction: the original 2019 data skipped Tha Phra and
 * joined Itsaraphap (BL32) straight to Bang Phai (BL33). Tha Phra sits
 * between them (Wikipedia's Tha Phra/Bang Phai station pages, MRTA's section
 * list and OSM relation 7725025 all agree) and opened to
 * the public with the 2019 southern extension. That was erroneous data, not
 * history - no era ever had a BL32__BL33 track link - so BL32__BL33 was
 * deleted rather than given a validity.to, which would assert a false past.
 *
 * Segment dates: a segment is dated by whichever endpoint opened LATER
 * (ties go to the `to` end), never blindly by its destination. Dating by
 * destination wrongly gave BL10__BL11 a 2004 start although Tao Poon (BL10)
 * only opened in 2017, and would equally mis-date the loop segments that
 * join the already-open Tha Phra and Tao Poon.
 *
 * Geometry and Thai/English names come from data/source/osm-raw.json
 * (CLAUDE.md 2.6). Opening dates and station-code assignments are curated
 * below from independent secondary sources, because OSM's `ref` tags mostly
 * reflect only the current-day map, not which stations existed - or what
 * they were coded - at any past date.
 */

type SeedDate = {
  date: string;
  date_precision?: DatePrecision;
  source_refs: SourceRef[];
};

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
   * they are listed only so segments can chain to them, not to be rewritten.
   * `date_precision` defaults to "exact". */
  opened?: SeedDate;
  /** Trial service predates commercial `opened` for the 2019 MRT southern
   * extension and the 2019-2020 Blue loop (CLAUDE.md 5: trial_run and opened
   * are distinct and both matter). Segments in that batch use the same pair. */
  trial_run?: SeedDate;
  /** Station-only milestones after the first opened, in date order. Tha Phra
   * (BL01) is one station with two levels: the lower level (2019 southern
   * extension) is `trial_run`/`opened` above, the upper level (2019-2020
   * loop) goes here. Not used to date segments. */
  extraMilestones?: Milestone[];
  /** Overrides OSM's `name:en` when OSM lacks it (Charan 13). Only for an
   * official English name from a fetched source, never romanised Thai. */
  name_en?: string;
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

// --- Sources for the 2019-2021 additions (each URL fetched when curated) ----
const BTS_HISTORY: SourceRef = {
  url: "https://www.bts.co.th/eng/info/info-history.html",
  title: "BTS Skytrain - History (Bangkok Mass Transit System PCL)",
  published_at: null,
};
const BTS_GROUP_JUN2020: SourceRef = {
  url: "https://www.btsgroup.co.th/en/update/news-event/603/bts-skytrain-begins-trial-operations-of-additional-four-stations-of-northern-green-line",
  title:
    "BTS Group - On 5 Jun 2020 an additional four stations (N14-N17) of the Northern Green Line extension begin trial operations",
  published_at: "2020-06-05",
};
const WIKI_KHU_KHOT: SourceRef = {
  url: "https://en.wikipedia.org/wiki/Khu_Khot_BTS_station",
  title:
    "Khu Khot BTS station - Wikipedia (N24, opened 16 December 2020, phase 4 of the Sukhumvit northern extension)",
  published_at: null,
};
const WTM_SAINT_LOUIS: SourceRef = {
  url: "https://en.wtmnews.net/20210208785",
  title:
    "New station Saint Louis opens on February 8 - BTS Silom Line in Bangkok (code S4)",
  published_at: "2021-02-08",
};
const MRTA_BLUE: SourceRef = {
  url: "https://www.mrta.co.th/en/chaloem-ratchamongkhon-line",
  title:
    "MRTA - The MRT Blue Line (Hua Lamphong - Bang Khae section: 29 September 2019; Bang Sue - Tha Phra section: 30 March 2020)",
  published_at: null,
};
const RAILWAY_NEWS_BLUE: SourceRef = {
  url: "https://railway-news.com/blue-line-extension-opens-on-bangkok-metro/",
  title:
    "Blue Line Extension Opens on Bangkok Metro (trial 29 July 2019, revenue service 29 September 2019)",
  published_at: null,
};
const MOTHERSHIP_BLUE_TRIAL: SourceRef = {
  url: "https://mothership.sg/2019/07/bangkok-blue-line-mrt/",
  title:
    "New Bangkok Blue Line MRT cuts travel time (free trial from 29 July 2019 to Wat Mangkon, Sam Yot, Sanam Chai, Itsaraphap and Tha Phra; official opening 29 September)",
  published_at: "2019-07-30",
};
const WIKI_THA_PHRA: SourceRef = {
  url: "https://en.wikipedia.org/wiki/Tha_Phra_MRT_station",
  title:
    "Tha Phra MRT station - Wikipedia (BL01; lower platform 29 July 2019, upper platform 23 December 2019)",
  published_at: null,
};
const WIKI_BLUE_LINE: SourceRef = {
  url: "https://en.wikipedia.org/wiki/Blue_Line_(Bangkok)",
  title:
    "Blue Line (Bangkok) - Wikipedia (Tao Poon-Tha Phra: shuttle trial 4 December 2019, to Tha Phra 23 December 2019, through service 1 March 2020, commercial 30 March 2020)",
  published_at: null,
};
const MGR_BLUE_DEC4: SourceRef = {
  url: "https://mgronline.com/uptodate/detail/9620000115906",
  title:
    "Manager Online - free trial of Blue Line Bang Pho-Sirindhorn from 4 December 2019; fares from 30 March 2020",
  published_at: "2019-12-03",
};
const MGR_BLUE_DEC23: SourceRef = {
  url: "https://mgronline.com/business/detail/9620000120725",
  title:
    "Manager Online - MRTA/BEM open Blue Line Tao Poon-Tha Phra trial service on 23 December 2019",
  published_at: "2019-12-18",
};
const RAILWAY_GAZETTE_LOOP: SourceRef = {
  url: "https://www.railwaygazette.com/urban/2020/01/07/bangkok-blue-line-loop-completed/",
  title:
    "Bangkok Blue Line loop completed - Railway Gazette (Section 3 trial operation from 23 December 2019)",
  published_at: "2020-01-07",
};
const THAILAND_CONSTRUCTION_BLUE: SourceRef = {
  url: "https://thailand-construction.com/bangkoks-mrt-blue-line-launches-full-service-from-30-march-2020/",
  title: "Bangkok's MRT Blue Line launches full service from 30 March 2020",
  published_at: "2020-04-01",
};
const RAILTRAVEL_THROUGH_SERVICE: SourceRef = {
  url: "https://railtravelstation.com/mrt-blue-line-tao-poon-tha-phra-extension-tao-poon-to-tha-phra-by-happy-blue-line-train-the-complete-bangkok-circle-line/",
  title:
    "RailTravel Station - MRT Blue Line Tao Poon-Tha Phra extension (through services since 1 March 2020)",
  published_at: "2020-03-05",
};

const opened = (date: string, ...refs: SourceRef[]): SeedDate => ({
  date,
  source_refs: refs,
});

const dated = (
  date: string,
  date_precision: DatePrecision,
  ...refs: SourceRef[]
): SeedDate => ({ date, date_precision, source_refs: refs });

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

// --- MRT Blue Line: Tao Poon to Lak Song (2004-2019 chain) -------------------
// Order is the real chain: Tao Poon at the north end, then the 2004 original
// section, then the 2019 southern extension, with Tha Phra (BL01) between
// Itsaraphap and Bang Phai. The Bang Sue-Tha Phra northern loop (BL02-BL09)
// is BLUE_LOOP_2020 further down; it joins this chain at BL10 and BL01.
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
  // Tha Phra: one station, two levels, ONE code (BL01). The lower level is the
  // 2019 southern-extension station between Itsaraphap and Bang Phai; the
  // upper level is the northern loop's terminus (2019-2020), recorded in
  // extraMilestones. Every source checked gives BL01 alone - BL34 is Bang Wa -
  // so code_history has the single default entry. Written here, not by the
  // loop group below, so there is one writer for the whole station file.
  {
    id: "BL01",
    osm_ref: "BL01",
    structure: "elevated",
    // MRTA's count of the extension stations (4 underground, 16 elevated)
    // leaves only Wat Mangkon, Sam Yot, Sanam Chai and Itsaraphap below ground.
    trial_run: opened("2019-07-29", MOTHERSHIP_BLUE_TRIAL, WIKI_THA_PHRA),
    opened: opened("2019-09-29", MRTA_BLUE, RAILWAY_NEWS_BLUE),
    extraMilestones: [
      {
        date: "2019-12-23",
        date_precision: "exact",
        event: "trial_run",
        source_refs: [MGR_BLUE_DEC23, RAILWAY_GAZETTE_LOOP, WIKI_THA_PHRA],
      },
      {
        date: "2020-03-30",
        date_precision: "exact",
        event: "opened",
        source_refs: [MRTA_BLUE, THAILAND_CONSTRUCTION_BLUE],
      },
    ],
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

// =============================================================================
// 2020-2021 additions to the existing lines
// =============================================================================

// --- BTS Sukhumvit: north extension, Kasetsart University to Khu Khot -------
// Two openings: N14-N17 on 2020-06-05, N18-N24 on 2020-12-16. Both were
// free-ride services. BTS's own press release calls 5 June 2020 "trial
// operations" while its history page says "commenced operation", and no
// separate fare-charging date is documented, so that date is marked
// `disputed` (two refs, per the schema) instead of guessing a trial_run +
// opened pair. 16 December 2020 is called "commenced operation" by BTS and
// "opened" by Wikipedia; nothing fetched calls it a trial.
const SUKHUMVIT_JUN2020 = dated(
  "2020-06-05",
  "disputed",
  BTS_HISTORY,
  BTS_GROUP_JUN2020,
);
const SUKHUMVIT_DEC2020 = opened("2020-12-16", BTS_HISTORY, WIKI_KHU_KHOT);
const SUKHUMVIT_NORTH_2020: SeedStation[] = [
  {
    id: "N13",
    osm_name: "มหาวิทยาลัยเกษตรศาสตร์",
    structure: "elevated",
  }, // 2019 boundary, written by SUKHUMVIT_NORTH_2019
  {
    id: "N14",
    osm_name: "กรมป่าไม้",
    structure: "elevated",
    opened: SUKHUMVIT_JUN2020,
  },
  {
    id: "N15",
    osm_name: "บางบัว",
    structure: "elevated",
    opened: SUKHUMVIT_JUN2020,
  },
  {
    id: "N16",
    osm_name: "กรมทหารราบที่ 11",
    structure: "elevated",
    opened: SUKHUMVIT_JUN2020,
  },
  {
    id: "N17",
    osm_ref: "N17",
    structure: "elevated",
    opened: SUKHUMVIT_JUN2020,
  },
  {
    id: "N18",
    osm_name: "พหลโยธิน 59",
    structure: "elevated",
    opened: SUKHUMVIT_DEC2020,
  },
  {
    id: "N19",
    osm_name: "สายหยุด",
    structure: "elevated",
    opened: SUKHUMVIT_DEC2020,
  },
  {
    id: "N20",
    osm_name: "สะพานใหม่",
    structure: "elevated",
    opened: SUKHUMVIT_DEC2020,
  },
  {
    id: "N21",
    osm_name: "โรงพยาบาลภูมิพลอดุลยเดช",
    structure: "elevated",
    opened: SUKHUMVIT_DEC2020,
  },
  {
    id: "N22",
    osm_name: "พิพิธภัณฑ์กองทัพอากาศ",
    structure: "elevated",
    opened: SUKHUMVIT_DEC2020,
  },
  {
    id: "N23",
    osm_name: "แยก คปอ.",
    structure: "elevated",
    opened: SUKHUMVIT_DEC2020,
  },
  {
    id: "N24",
    osm_name: "คูคต",
    structure: "elevated",
    opened: SUKHUMVIT_DEC2020,
  },
];

// --- MRT Blue: Tao Poon-Tha Phra northern loop (BL02-BL09) ------------------
// Free trial from Tao Poon to Sirindhorn on 2019-12-04 (Bang Pho, Bang O, Bang
// Phlat, Sirindhorn are the stations newly opened that day), the remaining
// stations to Tha Phra on 2019-12-23, fares from 2020-03-30. Wikipedia's
// station pages label the free trial dates "opened"; MRTA's 30 March 2020 is
// the commercial opening, so those are trial_run here. Station `validity`
// starts at the commercial opening, matching how the 2019 southern extension
// is dated (a trial_run never starts validity).
const LOOP_OPENED = opened("2020-03-30", MRTA_BLUE, THAILAND_CONSTRUCTION_BLUE);
const LOOP_TRIAL_DEC4 = opened("2019-12-04", MGR_BLUE_DEC4, WIKI_BLUE_LINE);
const LOOP_TRIAL_DEC23 = opened(
  "2019-12-23",
  MGR_BLUE_DEC23,
  RAILWAY_GAZETTE_LOOP,
);
const BLUE_LOOP_2020: SeedStation[] = [
  // Chain order BL01 -> BL10 gives ids BL01__BL02 ... BL09__BL10, the same
  // ascending direction as the existing BL10__BL11. BL01 and BL10 are both
  // written by BLUE_2019 (they exist from earlier eras) and appear here
  // without `opened` so the loop segments are dated by their loop end.
  { id: "BL01", osm_ref: "BL01", structure: "elevated" },
  {
    id: "BL02",
    osm_name: "จรัญฯ 13",
    // OSM has no name:en for this node; "Charan 13" is the name Wikipedia's
    // station page gives, not a romanisation of the Thai.
    name_en: "Charan 13",
    structure: "elevated",
    opened: LOOP_OPENED,
    trial_run: LOOP_TRIAL_DEC23,
  },
  {
    id: "BL03",
    osm_name: "ไฟฉาย",
    structure: "elevated",
    opened: LOOP_OPENED,
    trial_run: LOOP_TRIAL_DEC23,
  },
  {
    id: "BL04",
    osm_name: "บางขุนนนท์",
    structure: "elevated",
    opened: LOOP_OPENED,
    trial_run: LOOP_TRIAL_DEC23,
  },
  {
    id: "BL05",
    osm_name: "บางยี่ขัน",
    structure: "elevated",
    opened: LOOP_OPENED,
    trial_run: LOOP_TRIAL_DEC23,
  },
  {
    id: "BL06",
    osm_name: "สิรินธร",
    structure: "elevated",
    opened: LOOP_OPENED,
    trial_run: LOOP_TRIAL_DEC4,
  },
  {
    id: "BL07",
    osm_name: "บางพลัด",
    structure: "elevated",
    opened: LOOP_OPENED,
    trial_run: LOOP_TRIAL_DEC4,
  },
  {
    id: "BL08",
    osm_name: "บางอ้อ",
    structure: "elevated",
    opened: LOOP_OPENED,
    trial_run: LOOP_TRIAL_DEC4,
  },
  {
    id: "BL09",
    osm_name: "บางโพ",
    structure: "elevated",
    opened: LOOP_OPENED,
    trial_run: LOOP_TRIAL_DEC4,
  },
  { id: "BL10", osm_ref: "BL10", osm_name: "เตาปูน", structure: "elevated" },
];

// --- BTS Silom: Saint Louis infill (S4) -------------------------------------
// S4 splits the existing S3-S5 link. S3 and S5 are 1999 stations written by
// seed-1999.ts (skipWriteIds); the retired S3__S5 segment is also seed-1999's.
const SILOM_INFILL_2021: SeedStation[] = [
  { id: "S3", osm_ref: "S3", structure: "elevated" },
  {
    id: "S4",
    osm_ref: "S4",
    structure: "elevated",
    opened: opened("2021-02-08", BTS_HISTORY, WTM_SAINT_LOUIS),
  },
  { id: "S5", osm_ref: "S5", structure: "elevated" },
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
    {
      date: SUKHUMVIT_JUN2020.date,
      date_precision: "disputed",
      event: "extended",
      source_refs: SUKHUMVIT_JUN2020.source_refs,
    },
    {
      date: SUKHUMVIT_DEC2020.date,
      date_precision: "exact",
      event: "extended",
      source_refs: SUKHUMVIT_DEC2020.source_refs,
    },
  ],
  confidence: "high",
  last_verified_at: "2026-10-06",
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
    {
      // Saint Louis is an infill station, not an extension; the milestone enum
      // has no infill event and CLAUDE.md forbids inventing one without an ADR.
      date: "2021-02-08",
      date_precision: "exact",
      event: "extended",
      source_refs: [BTS_HISTORY, WTM_SAINT_LOUIS],
    },
  ],
  confidence: "high",
  last_verified_at: "2026-10-06",
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
    {
      date: "2019-12-04",
      date_precision: "exact",
      event: "trial_run",
      source_refs: LOOP_TRIAL_DEC4.source_refs,
    },
    {
      date: "2019-12-23",
      date_precision: "exact",
      event: "trial_run",
      source_refs: LOOP_TRIAL_DEC23.source_refs,
    },
    {
      // Through-running from Tha Phra to Lak Song via Bang Sue began, still
      // free, a month before fares.
      date: "2020-03-01",
      date_precision: "exact",
      event: "trial_run",
      source_refs: [WIKI_BLUE_LINE, RAILTRAVEL_THROUGH_SERVICE],
    },
    {
      date: LOOP_OPENED.date,
      date_precision: "exact",
      event: "extended",
      source_refs: LOOP_OPENED.source_refs,
    },
  ],
  confidence: "high",
  last_verified_at: "2026-10-06",
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

const VERIFIED_PRE_2020 = "2026-09-01";
const VERIFIED_2020_21 = "2026-10-06";
// Entities from before 2020 whose content this revision changed or created,
// so they carry the newer verification date. Everything dated 2020 or later
// is new and gets it automatically.
const REVERIFIED_IDS = new Set([
  "BL01",
  "BL10__BL11",
  "BL32__BL01",
  "BL01__BL33",
]);
const verifiedAt = (id: string, firstDate: string) =>
  REVERIFIED_IDS.has(id) || firstDate >= "2020-01-01"
    ? VERIFIED_2020_21
    : VERIFIED_PRE_2020;

/**
 * `resolveCoords` averages every OSM node matching a seed's name, so a Thai
 * name shared with another station would silently pull the coordinate
 * somewhere between the two. Real candidates for one station sit within a
 * platform's length of each other; fail loudly instead of publishing a
 * midpoint.
 */
const MAX_CANDIDATE_SPREAD_M = 400;
function assertCandidatesClustered(
  seed: SeedStation,
  elements: OsmElement[],
): void {
  const nodes = stationCandidates(seed, elements);
  for (const a of nodes) {
    for (const b of nodes) {
      const dLat = (a.lat! - b.lat!) * 111_320;
      const dLon =
        (a.lon! - b.lon!) * 111_320 * Math.cos((a.lat! * Math.PI) / 180);
      const meters = Math.hypot(dLat, dLon);
      if (meters > MAX_CANDIDATE_SPREAD_M) {
        throw new Error(
          `OSM nodes for seed ${seed.id} are ${Math.round(meters)} m apart (nodes ${a.id}, ${b.id}); the name/ref matches more than one station`,
        );
      }
    }
  }
}

function buildStation(
  seed: SeedStation,
  lineId: string,
  elements: OsmElement[],
  checkSpread: boolean,
): Station {
  if (checkSpread) assertCandidatesClustered(seed, elements);
  const resolved = resolveCoords(seed, elements, seed.id);
  const { lat, lon, name_th } = resolved;
  const name_en = seed.name_en ?? resolved.name_en;

  const code_history =
    seed.code_history ??
    (seed.opened
      ? [{ code: seed.id, from: seed.opened.date, to: null }]
      : [{ code: seed.id, from: "1999-12-05", to: null }]); // boundary carry-over; never actually written

  const milestones: Milestone[] = [];
  if (seed.trial_run) {
    milestones.push({
      date: seed.trial_run.date,
      date_precision: seed.trial_run.date_precision ?? "exact",
      event: "trial_run",
      source_refs: seed.trial_run.source_refs,
    });
  }
  if (seed.opened) {
    milestones.push({
      date: seed.opened.date,
      date_precision: seed.opened.date_precision ?? "exact",
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

  milestones.push(...(seed.extraMilestones ?? []));

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
    last_verified_at: verifiedAt(seed.id, seed.opened?.date ?? "1999-12-05"),
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

/**
 * A segment exists from the moment BOTH its stations are open, so it takes its
 * dates and sources from whichever endpoint opened later; on a tie, from the
 * `to` end (the historical behaviour). An endpoint with no `opened` in this
 * seed list is a carry-over boundary from an earlier era and never defines the
 * date. The trial_run comes from the same defining endpoint, so a segment
 * joining an already-open station to a loop station that had a trial inherits
 * the loop station's trial, not a stale one from the other end.
 */
function segmentDating(
  from: SeedStation,
  to: SeedStation,
): { opened: SeedDate; trial_run?: SeedDate } {
  if (!from.opened && !to.opened) {
    throw new Error(
      `Segment ${from.id}__${to.id}: neither end has an opened date`,
    );
  }
  const definer =
    !from.opened || (to.opened && to.opened.date >= from.opened.date)
      ? to
      : from;
  return { opened: definer.opened!, trial_run: definer.trial_run };
}

function buildSegments(
  lineId: string,
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
    const to = seeds[i + 1]!;
    const fromStation = stationById.get(from.id)!;
    const toStation = stationById.get(to.id)!;
    const m = segmentDating(from, to);

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
        date: m.trial_run.date,
        date_precision: m.trial_run.date_precision ?? "exact",
        event: "trial_run",
        source_refs: m.trial_run.source_refs,
      });
    }
    milestones.push({
      date: m.opened.date,
      date_precision: m.opened.date_precision ?? "exact",
      event: "opened",
      source_refs: m.opened.source_refs,
    });

    const id = `${from.id}__${to.id}`;
    return {
      id,
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
      validity: [{ from: m.opened.date, to: null }],
      milestones,
      confidence: "medium" as const,
      last_verified_at: verifiedAt(id, m.opened.date),
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
    /** Only the 2020-2021 groups opt in: the older seeds predate the check
     * and e.g. PP11's two OSM nodes are 548 m apart, which is an existing
     * data question rather than something to fail this run over. */
    checkSpread?: true;
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
    // --- 2020-2021 additions to existing lines ---
    {
      seeds: SUKHUMVIT_NORTH_2020,
      lineId: "BTS_SUKHUMVIT",
      namePrefixes: ["BTS Sukhumvit Line"],
      skipWriteIds: new Set(["N13"]), // written by SUKHUMVIT_NORTH_2019
      checkSpread: true,
    },
    {
      seeds: BLUE_LOOP_2020,
      lineId: "MRT_BLUE",
      namePrefixes: ["MRT Blue Line"],
      // BL01 and BL10 are written by BLUE_2019 (dedup below ignores these
      // copies); listed so the loop's end segments chain to them.
      skipWriteIds: new Set(["BL01", "BL10"]),
      checkSpread: true,
    },
    {
      seeds: SILOM_INFILL_2021,
      lineId: "BTS_SILOM",
      namePrefixes: ["BTS Silom Line"],
      skipWriteIds: new Set(["S3", "S5"]), // 1999 stations, written by seed-1999.ts
      checkSpread: true,
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
      const station = buildStation(
        seed,
        group.lineId,
        elements,
        group.checkSpread === true,
      );
      allStations.set(seed.id, station);
      if (!group.skipWriteIds.has(seed.id)) {
        stationsToWrite.set(seed.id, station);
      }
    }
  }

  for (const group of groups) {
    const { segments, traced } = buildSegments(
      group.lineId,
      group.seeds,
      allStations,
      elements,
      group.namePrefixes,
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
    `Seeded ${stationsToWrite.size} stations, ${LINES.length} lines (3 restated with full history), ` +
      `${totalSegments} segments (${totalTraced} traced from OSM, ${totalSegments - totalTraced} straight-line fallback) ` +
      `for the 2021-12-31 network of the pre-existing lines`,
  );
}

main();

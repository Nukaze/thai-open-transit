// apps/web/lib/i18n.ts

/** A language the UI is fully translated into. Only these reach `t()`. */
export type Lang = "en" | "th";

/** Flags drawn by `Flag.tsx`. Optional per language: a language with no
 *  fitting flag simply goes without. */
export type FlagId = "us-gb" | "th" | "jp" | "cn";

export type LanguageOption =
  | { code: Lang; native: string; flag?: FlagId; ready: true }
  // Listed in the picker but not selectable yet, so visitors can see what
  // is coming. Typed apart so `t()` can never receive one of these codes.
  | { code: string; native: string; flag?: FlagId; ready: false };

// Each language in its own script, so a reader finds theirs at a glance
// whatever the page's current language is.
export const LANGUAGES: LanguageOption[] = [
  { code: "en", native: "English", flag: "us-gb", ready: true },
  { code: "th", native: "ไทย", flag: "th", ready: true },
  { code: "ja", native: "日本語", flag: "jp", ready: false },
  // Mainland China. Traditional Chinese (Taiwan) would be its own entry.
  { code: "zh", native: "中文", flag: "cn", ready: false },
];

/** First of the browser's preferred languages the UI supports, else English. */
export function detectLang(preferences: readonly string[]): Lang {
  for (const pref of preferences) {
    const base = pref.toLowerCase().split("-")[0];
    if (base === "th" || base === "en") return base;
  }
  return "en";
}

export const DICTIONARY: Record<string, Record<Lang, string>> = {
  search_placeholder: { th: "ค้นหาสถานี...", en: "Search stations..." },
  report_error: { th: "แจ้งข้อผิดพลาด", en: "Report an error" },
  last_verified: { th: "ตรวจสอบล่าสุด", en: "Last verified" },
  download_dataset: { th: "ดาวน์โหลดชุดข้อมูล", en: "Download dataset" },
  theme_to_dark: { th: "โหมดมืด", en: "Dark map" },
  theme_to_light: { th: "โหมดสว่าง", en: "Light map" },
  station_labels: { th: "ป้ายสถานี", en: "Station labels" },
  nearest_station: { th: "สถานีใกล้สุด", en: "Nearest" },
  geolocate_denied: {
    th: "ไม่ได้รับอนุญาตให้เข้าถึงตำแหน่ง",
    en: "Location permission denied",
  },
  geolocate_unavailable: {
    th: "ไม่สามารถระบุตำแหน่งได้",
    en: "Location unavailable",
  },
  geolocate_timeout: {
    th: "ระบุตำแหน่งไม่ทันเวลา",
    en: "Location request timed out",
  },
  search_where: { th: "ไปสถานีไหน?", en: "Which station?" },
  no_results: { th: "ไม่พบสถานี", en: "No stations found" },
  lines: { th: "สายรถไฟ", en: "Lines" },
  show_all: { th: "แสดงทั้งหมด", en: "Show all" },
  hide_all: { th: "ซ่อนทั้งหมด", en: "Hide all" },
  show: { th: "แสดง", en: "Show" },
  hide: { th: "ซ่อน", en: "Hide" },
  show_group: { th: "แสดงสาย{group}ทั้งหมด", en: "Show all {group} lines" },
  hide_group: { th: "ซ่อนสาย{group}ทั้งหมด", en: "Hide all {group} lines" },
  lines_hint: {
    th: "แตะสายเพื่อแสดงหรือซ่อนบนแผนที่",
    en: "Tap a line to show or hide it on the map.",
  },
  lines_shown: {
    th: "แสดง {shown}/{total}",
    en: "{shown} of {total} shown",
  },
  group_bts: { th: "รถไฟฟ้าบีทีเอส", en: "BTS Skytrain" },
  group_mrt: { th: "รถไฟฟ้ามหานคร (MRT)", en: "MRT" },
  group_srt: { th: "รถไฟชานเมือง (SRT)", en: "SRT & Airport Rail Link" },
  time_travel: { th: "ย้อนเวลา", en: "Time travel" },
  today: { th: "วันนี้", en: "Today" },
  back_to_today: { th: "กลับมาปัจจุบัน", en: "Back to today" },
  network_as_of: { th: "สิ้นปี", en: "Network at year end" },
  map_settings: { th: "แผนที่", en: "Map" },
  appearance: { th: "ธีม", en: "Appearance" },
  light: { th: "สว่าง", en: "Light" },
  dark: { th: "มืด", en: "Dark" },
  ring_color: { th: "สีวงสถานีที่เลือก", en: "Selection ring" },
  for_dark_map: { th: "สำหรับแผนที่มืด", en: "For the dark map" },
  for_light_map: { th: "สำหรับแผนที่สว่าง", en: "For the light map" },
  structure: { th: "โครงสร้าง", en: "Structure" },
  accessible: { th: "รองรับผู้พิการ", en: "Accessible" },
  opened: { th: "เปิดให้บริการ", en: "Opened" },
  not_yet_opened: { th: "ยังไม่เปิด", en: "Not yet opened" },
  details: { th: "รายละเอียด", en: "Details" },
  share: { th: "แชร์", en: "Share" },
  copied: { th: "คัดลอกแล้ว", en: "Link copied" },
  locate_me: { th: "ตำแหน่งของฉัน", en: "Show my location" },
  locate_stop: { th: "หยุดติดตามตำแหน่ง", en: "Stop following my location" },
  view_3d: { th: "มุมมอง 3 มิติ", en: "Tilt to 3D view" },
  view_2d: { th: "มุมมอง 2 มิติ", en: "Flatten to 2D view" },
  reset_north: { th: "หันทิศเหนือขึ้น", en: "Point north up" },
  more_controls: { th: "ควบคุมกล้องเพิ่มเติม", en: "More camera controls" },
  tilt: { th: "มุมเอียงแผนที่", en: "Map tilt" },
  tilt_up: { th: "เอียงแผนที่เพิ่ม", en: "Tilt up" },
  tilt_down: { th: "เอียงแผนที่ลด", en: "Tilt down" },
  reset_view: { th: "กลับสู่มุมมองเริ่มต้น", en: "Reset view" },
  zoom_in: { th: "ซูมเข้า", en: "Zoom in" },
  zoom_out: { th: "ซูมออก", en: "Zoom out" },
  language: { th: "ภาษา", en: "Language" },
  coming_soon: { th: "เร็วๆ นี้", en: "Coming soon" },
  map_controls: { th: "ควบคุมแผนที่", en: "Map controls" },
  map_panel: { th: "แผงแผนที่", en: "Map panel" },
  expand_panel: { th: "ขยายแผง", en: "Expand panel" },
  collapse_panel: { th: "ย่อแผง", en: "Collapse panel" },
  project: { th: "โครงการ", en: "Project" },
  close: { th: "ปิด", en: "Close" },
  clear_search: { th: "ล้างคำค้นหา", en: "Clear search" },
  search_results: { th: "ผลการค้นหา", en: "Search results" },
  yes: { th: "ใช่", en: "Yes" },
  no: { th: "ไม่", en: "No" },
  unknown: { th: "ไม่ทราบ", en: "Unknown" },
  status_operational: { th: "เปิดให้บริการ", en: "Operational" },
  status_trial: { th: "ทดลองเดินรถ", en: "Trial service" },
  status_under_construction: { th: "กำลังก่อสร้าง", en: "Under construction" },
  status_approved: { th: "อนุมัติแล้ว", en: "Approved" },
  status_planned: { th: "อยู่ในแผน", en: "Planned" },
  status_proposed: { th: "ข้อเสนอ", en: "Proposed" },
  status_suspended: { th: "หยุดให้บริการชั่วคราว", en: "Suspended" },
  status_cancelled: { th: "ยกเลิก", en: "Cancelled" },
  structure_elevated: { th: "ยกระดับ", en: "Elevated" },
  structure_underground: { th: "ใต้ดิน", en: "Underground" },
  structure_at_grade: { th: "ระดับดิน", en: "At grade" },
  visits_total: { th: "เข้าชมทั้งหมด {n} ครั้ง", en: "{n} views" },
  visits_today: { th: "วันนี้ {n}", en: "{n} today" },
  visits_dev: {
    th: "โหมดพัฒนา: ไม่นับยอดเข้าชม",
    en: "Development mode: views not counted",
  },
};

export function t(key: string, lang: Lang): string {
  return DICTIONARY[key]?.[lang] ?? key;
}

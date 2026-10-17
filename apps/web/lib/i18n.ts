// apps/web/lib/i18n.ts

const DICTIONARY: Record<string, { th: string; en: string }> = {
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
  time_travel: { th: "ย้อนเวลา", en: "Time travel" },
  today: { th: "วันนี้", en: "Today" },
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
};

export function t(key: string, lang: "th" | "en"): string {
  return DICTIONARY[key]?.[lang] ?? key;
}

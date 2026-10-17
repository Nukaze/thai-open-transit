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
};

export function t(key: string, lang: "th" | "en"): string {
  return DICTIONARY[key]?.[lang] ?? key;
}

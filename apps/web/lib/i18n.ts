// apps/web/lib/i18n.ts

const DICTIONARY: Record<string, { th: string; en: string }> = {
  search_placeholder: { th: "ค้นหาสถานี...", en: "Search stations..." },
  report_error: { th: "แจ้งข้อผิดพลาด", en: "Report an error" },
  last_verified: { th: "ตรวจสอบล่าสุด", en: "Last verified" },
  download_dataset: { th: "ดาวน์โหลดชุดข้อมูล", en: "Download dataset" },
};

export function t(key: string, lang: "th" | "en"): string {
  return DICTIONARY[key]?.[lang] ?? key;
}

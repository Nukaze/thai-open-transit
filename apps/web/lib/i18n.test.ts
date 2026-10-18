// apps/web/lib/i18n.test.ts
import { describe, it, expect } from "vitest";
import { DICTIONARY, LANGUAGES, detectLang, t } from "./i18n";
import { lineShortName } from "./lineGroups";
import type { Line } from "schema";

describe("t", () => {
  it("returns the Thai string for a known key when lang is th", () => {
    expect(t("search_placeholder", "th")).toBe("ค้นหาสถานี...");
  });

  it("returns the English string for a known key when lang is en", () => {
    expect(t("search_placeholder", "en")).toBe("Search stations...");
  });

  it("falls back to the key itself when the key is unknown", () => {
    expect(t("unknown_key", "en")).toBe("unknown_key");
  });

  it("has a non-empty string in both languages for every key", () => {
    for (const [key, entry] of Object.entries(DICTIONARY)) {
      expect(entry.en.trim(), `${key}.en`).not.toBe("");
      expect(entry.th.trim(), `${key}.th`).not.toBe("");
    }
  });
});

describe("detectLang", () => {
  it("picks Thai when the browser prefers a Thai locale", () => {
    expect(detectLang(["th-TH", "en"])).toBe("th");
  });

  it("skips unsupported languages for the first supported one", () => {
    expect(detectLang(["ja", "en-GB"])).toBe("en");
    expect(detectLang(["fr", "th"])).toBe("th");
  });

  it("falls back to English with no usable preference", () => {
    expect(detectLang([])).toBe("en");
    expect(detectLang(["ja", "zh-CN"])).toBe("en");
  });
});

describe("LANGUAGES", () => {
  it("offers exactly the languages t() supports as selectable", () => {
    const ready = LANGUAGES.filter((l) => l.ready).map((l) => l.code);
    expect(ready.sort()).toEqual(["en", "th"]);
  });
});

describe("lineShortName", () => {
  const line = (name_en: string, name_th: string) =>
    ({ name_en, name_th }) as Line;

  it("drops the brand in Thai, keeping the line's own name", () => {
    expect(
      lineShortName(line("BTS Gold Line", "รถไฟฟ้าบีทีเอส สายสีทอง"), "th"),
    ).toBe("สายสีทอง");
  });

  it("keeps a Thai name with no space whole", () => {
    const arl = "รถไฟฟ้าเชื่อมท่าอากาศยานสุวรรณภูมิ";
    expect(lineShortName(line("Airport Rail Link", arl), "th")).toBe(arl);
  });

  it("drops brand and 'Line' in English", () => {
    expect(lineShortName(line("BTS Gold Line", "x"), "en")).toBe("Gold");
  });
});

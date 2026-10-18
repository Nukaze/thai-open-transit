import { describe, expect, it } from "vitest";
import { fontPicksCss, parseFontPicks } from "./devFonts";

describe("parseFontPicks", () => {
  it("keeps known targets and fonts only", () => {
    expect(
      parseFontPicks(
        JSON.stringify({ th: "chakra", en: "comic", brand: "toString", x: 1 }),
      ),
    ).toEqual({ th: "chakra" });
  });

  it("falls back to no picks on missing or broken storage", () => {
    expect(parseFontPicks(null)).toEqual({});
    expect(parseFontPicks("{not json")).toEqual({});
    expect(parseFontPicks('"chakra"')).toEqual({});
  });
});

describe("fontPicksCss", () => {
  it("is empty with no picks, so the globals.css defaults apply", () => {
    expect(fontPicksCss({})).toBe("");
  });

  it("writes Thai under :root:lang(th) and English and brand under :root", () => {
    expect(fontPicksCss({ th: "noto", en: "system", brand: "chakra" })).toBe(
      ":root {\n" +
        "  --font-ui: var(--font-system);\n" +
        '  --font-brand: "Chakra Petch", var(--font-system);\n' +
        "}\n\n" +
        ":root:lang(th) {\n" +
        '  --font-ui: "Noto Sans Thai", var(--font-system);\n' +
        "}",
    );
  });
});

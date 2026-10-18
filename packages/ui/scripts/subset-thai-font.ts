// packages/ui/scripts/subset-thai-font.ts
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import subsetFont from "subset-font";

// Thai script block + Latin + digits + common punctuation - covers name_th,
// name_en, and station codes rendered in-app.
const GLYPH_SUBSET =
  " !\"#%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[]abcdefghijklmnopqrstuvwxyz" +
  "กขฃคฅฆงจฉชซฌญฎฏ" +
  "ฐฑฒณดตถทธนบปผฝพ" +
  "ฟภมยรฤลฦวศษสหฬอ" +
  "ฮฯะัาำิีึืฺุู฿เ" +
  "แโใไๅๆ็่้๊๋์ํ๎๏" +
  "๐๑๒๓๔๕๖๗๘๙";

// Every self-hosted UI font, subset to the same glyphs. Licenses: fonts/OFL.txt
// (copied next to the output). Chakra Petch is the UI font (Thai) and brand
// fallback; two weights only, the CSS maps 500 to 400 and 650 to 600.
export const FONTS = [
  { source: "NotoSansThai-Regular.ttf", output: "NotoSansThai-subset.woff2" },
  {
    source: "ChakraPetch-Regular.ttf",
    output: "ChakraPetch-Regular-subset.woff2",
  },
  {
    source: "ChakraPetch-SemiBold.ttf",
    output: "ChakraPetch-SemiBold-subset.woff2",
  },
] as const;

export async function subsetThaiFont(): Promise<void> {
  const outputDir = new URL("../../../apps/web/public/fonts/", import.meta.url);
  mkdirSync(outputDir, { recursive: true });
  for (const font of FONTS) {
    const original = readFileSync(
      new URL(`../fonts/${font.source}`, import.meta.url),
    );
    const subset = await subsetFont(original, GLYPH_SUBSET, {
      targetFormat: "woff2",
    });
    writeFileSync(new URL(font.output, outputDir), subset);
  }
}

if (import.meta.main) {
  await subsetThaiFont();
}

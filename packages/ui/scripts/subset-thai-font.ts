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

export async function subsetThaiFont(): Promise<void> {
  const inputPath = new URL(
    "../fonts/NotoSansThai-Regular.ttf",
    import.meta.url,
  );
  const outputDir = new URL("../../../apps/web/public/fonts/", import.meta.url);
  const outputPath = new URL("NotoSansThai-subset.woff2", outputDir);

  const original = readFileSync(inputPath);
  const subset = await subsetFont(original, GLYPH_SUBSET, {
    targetFormat: "woff2",
  });

  mkdirSync(outputDir, { recursive: true });
  writeFileSync(outputPath, subset);
}

if (import.meta.main) {
  await subsetThaiFont();
}

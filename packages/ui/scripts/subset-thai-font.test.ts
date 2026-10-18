// packages/ui/scripts/subset-thai-font.test.ts
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { FONTS, subsetThaiFont } from "./subset-thai-font";

describe("subsetThaiFont", () => {
  it("keeps the self-hosted fonts together under the 80KB budget", async () => {
    await subsetThaiFont();
    let total = 0;
    for (const font of FONTS) {
      const outputPath = new URL(
        `../../../apps/web/public/fonts/${font.output}`,
        import.meta.url,
      );
      expect(existsSync(outputPath)).toBe(true);
      total += readFileSync(outputPath).byteLength;
    }
    expect(total).toBeLessThan(80 * 1024);
  });
});

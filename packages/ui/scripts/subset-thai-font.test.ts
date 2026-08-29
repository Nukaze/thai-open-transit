// packages/ui/scripts/subset-thai-font.test.ts
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { subsetThaiFont } from './subset-thai-font';

describe('subsetThaiFont', () => {
  it('produces a woff2 file smaller than the 80KB budget', async () => {
    const outputPath = new URL('../../../apps/web/public/fonts/NotoSansThai-subset.woff2', import.meta.url);
    await subsetThaiFont();
    expect(existsSync(outputPath)).toBe(true);
    const stats = readFileSync(outputPath);
    expect(stats.byteLength).toBeLessThan(80 * 1024);
  });
});

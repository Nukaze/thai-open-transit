import { describe, it, expect } from 'vitest';
import { LineSchema } from './line';

describe('LineSchema', () => {
  it('accepts a valid line record', () => {
    const line = {
      id: 'MRT_BLUE',
      operator: 'BEM',
      name_th: 'รถไฟฟ้ามหานคร สายเฉลิมรัชมงคล',
      name_en: 'MRT Blue Line',
      color_hex: '#1E3A8A',
      milestones: [
        {
          date: '2004-07-03',
          date_precision: 'exact',
          event: 'opened',
          source_refs: [{ url: 'https://example.com/a', title: 'MRTA', published_at: '2004-07-03' }],
        },
      ],
      confidence: 'high',
      last_verified_at: '2026-07-01',
    };
    expect(LineSchema.safeParse(line).success).toBe(true);
  });

  it('rejects a color_hex that is not a hex color', () => {
    const line = {
      id: 'MRT_BLUE',
      operator: 'BEM',
      name_th: 'a',
      name_en: 'b',
      color_hex: 'blue',
      milestones: [],
      confidence: 'high',
      last_verified_at: '2026-07-01',
    };
    expect(LineSchema.safeParse(line).success).toBe(false);
  });
});

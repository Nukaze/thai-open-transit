import { describe, it, expect } from 'vitest';
import { SegmentSchema } from './segment';

describe('SegmentSchema', () => {
  it('accepts a valid segment and derives id shape', () => {
    const segment = {
      id: 'BL15__BL16',
      line: 'MRT_BLUE',
      from_station: 'BL15',
      to_station: 'BL16',
      milestones: [],
      confidence: 'high',
      last_verified_at: '2026-07-01',
    };
    expect(SegmentSchema.safeParse(segment).success).toBe(true);
  });

  it('rejects an id that does not match {FROM}__{TO}', () => {
    const segment = {
      id: 'BL15-BL16',
      line: 'MRT_BLUE',
      from_station: 'BL15',
      to_station: 'BL16',
      milestones: [],
      confidence: 'high',
      last_verified_at: '2026-07-01',
    };
    expect(SegmentSchema.safeParse(segment).success).toBe(false);
  });
});

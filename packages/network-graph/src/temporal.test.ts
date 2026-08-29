import { describe, it, expect } from 'vitest';
import { filterAsOf } from './temporal';

interface Entity {
  id: string;
  validity: { from: string; to: string | null }[];
}

describe('filterAsOf', () => {
  const entities: Entity[] = [
    { id: 'ALWAYS_OPEN', validity: [{ from: '2004-01-01', to: null }] },
    { id: 'CLOSED_2020', validity: [{ from: '2004-01-01', to: '2020-01-01' }] },
    { id: 'OPENS_2030', validity: [{ from: '2030-01-01', to: null }] },
  ];

  it('includes entities whose validity window covers the date', () => {
    const result = filterAsOf(entities, '2026-01-01');
    expect(result.map((e) => e.id)).toEqual(['ALWAYS_OPEN']);
  });

  it('excludes entities not yet valid or already closed at the given date', () => {
    const result2019 = filterAsOf(entities, '2019-01-01');
    expect(result2019.map((e) => e.id).sort()).toEqual(['ALWAYS_OPEN', 'CLOSED_2020']);

    const result2031 = filterAsOf(entities, '2031-01-01');
    expect(result2031.map((e) => e.id).sort()).toEqual(['ALWAYS_OPEN', 'OPENS_2030']);
  });

  it('excludes entities exactly at their to boundary (half-open interval semantics)', () => {
    // CLOSED_2020 has validity [from: '2004-01-01', to: '2020-01-01']
    // Half-open interval means [2004-01-01, 2020-01-01) - the to date is excluded
    const result = filterAsOf(entities, '2020-01-01');
    expect(result.map((e) => e.id)).toEqual(['ALWAYS_OPEN']);
  });
});

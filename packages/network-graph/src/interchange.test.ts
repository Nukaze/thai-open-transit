import { describe, it, expect } from 'vitest';
import { resolveInterchangeGroups } from './interchange';
import type { Station } from 'schema';

function makeStation(id: string, group: string | undefined): Station {
  return {
    id,
    name_th: id,
    name_en: id,
    code_history: [{ code: id, from: '2026-01-01', to: null }],
    interchange_group: group,
    structure: 'elevated',
    accessible: true,
    coords: { geo: { lat: 13.75, lon: 100.5 } },
    validity: [],
    milestones: [],
    confidence: 'high',
    last_verified_at: '2026-07-01',
  };
}

describe('resolveInterchangeGroups', () => {
  it('groups stations sharing the same interchange_group', () => {
    const stations = [
      makeStation('N8', 'MOCHIT_CHATUCHAK'),
      makeStation('BL01', 'MOCHIT_CHATUCHAK'),
      makeStation('LONELY', undefined),
    ];
    const groups = resolveInterchangeGroups(stations);
    expect(groups.get('MOCHIT_CHATUCHAK')?.sort()).toEqual(['BL01', 'N8']);
    expect(groups.has('LONELY')).toBe(false);
  });
});

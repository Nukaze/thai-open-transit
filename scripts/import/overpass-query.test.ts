import { describe, it, expect } from 'vitest';
import { buildOverpassQuery } from './overpass-query';

describe('buildOverpassQuery', () => {
  it('builds a query scoped to the given bbox targeting rail route relations', () => {
    const query = buildOverpassQuery([13.4, 100.2, 14.2, 100.95]);
    expect(query).toContain('[bbox:13.4,100.2,14.2,100.95]');
    expect(query).toContain('route~"light_rail|subway|monorail"');
  });
});

import { describe, it, expect } from 'vitest';
import { renderSchematic } from './render';
import type { Layout, Station, Segment } from 'schema';

describe('renderSchematic', () => {
  it('renders an SVG containing a circle per station and a line per segment', () => {
    const layout: Layout = {
      era: 'test',
      stations: [
        { station_id: 'A', x: 0, y: 0 },
        { station_id: 'B', x: 100, y: 0 },
      ],
    };
    const stations = [
      { id: 'A', name_th: 'A', name_en: 'A' } as Station,
      { id: 'B', name_th: 'B', name_en: 'B' } as Station,
    ];
    const segments = [
      { id: 'A__B', line: 'TEST', from_station: 'A', to_station: 'B' } as Segment,
    ];

    const svg = renderSchematic(layout, stations, segments);

    expect(svg).toContain('<svg');
    expect(svg).toContain('</svg>');
    expect((svg.match(/<circle/g) ?? []).length).toBe(2);
    expect((svg.match(/<line/g) ?? []).length).toBe(1);
  });

  it('throws if a segment references a station missing from the layout', () => {
    const layout: Layout = { era: 'test', stations: [{ station_id: 'A', x: 0, y: 0 }] };
    const stations = [{ id: 'A', name_th: 'A', name_en: 'A' } as Station];
    const segments = [
      { id: 'A__MISSING', line: 'TEST', from_station: 'A', to_station: 'MISSING' } as Segment,
    ];

    expect(() => renderSchematic(layout, stations, segments)).toThrow(
      'Segment A__MISSING references a station missing from the layout: MISSING',
    );
  });

  it('escapes XML special characters in station names', () => {
    const layout: Layout = {
      era: 'test',
      stations: [
        { station_id: 'A', x: 0, y: 0 },
        { station_id: 'B', x: 100, y: 0 },
        { station_id: 'C', x: 200, y: 0 },
        { station_id: 'D', x: 300, y: 0 },
      ],
    };
    const stations = [
      { id: 'A', name_th: 'A & B', name_en: 'A & B' } as Station,
      { id: 'B', name_th: '<Test>', name_en: '<Test>' } as Station,
      { id: 'C', name_th: 'A "quoted"', name_en: 'A "quoted"' } as Station,
      { id: 'D', name_th: "A 'quoted'", name_en: "A 'quoted'" } as Station,
    ];
    const segments = [] as Segment[];

    const svg = renderSchematic(layout, stations, segments);

    expect(svg).toContain('<title>A &amp; B</title>');
    expect(svg).toContain('<title>&lt;Test&gt;</title>');
    expect(svg).toContain('<title>A &quot;quoted&quot;</title>');
    expect(svg).toContain("<title>A &apos;quoted&apos;</title>");
  });
});

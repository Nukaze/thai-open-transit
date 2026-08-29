import type { Layout, Station, Segment } from "schema";

function escapeXml(value: string): string {
  return value.replace(/[&<>'"]/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case "'":
        return "&apos;";
      case '"':
        return "&quot;";
      default:
        return char;
    }
  });
}

function safeCoord(value: number): number {
  if (!Number.isFinite(value)) {
    throw new Error(`Invalid coordinate value: ${value}`);
  }
  return value;
}

export function renderSchematic(
  layout: Layout,
  stations: Station[],
  segments: Segment[],
): string {
  const positionByStationId = new Map(
    layout.stations.map((s) => [s.station_id, s]),
  );
  const stationNameById = new Map(
    stations.map((s) => [s.id, s.name_en ?? s.name_th]),
  );

  const lines = segments
    .map((segment) => {
      const from = positionByStationId.get(segment.from_station);
      const to = positionByStationId.get(segment.to_station);
      if (!from) {
        throw new Error(
          `Segment ${segment.id} references a station missing from the layout: ${segment.from_station}`,
        );
      }
      if (!to) {
        throw new Error(
          `Segment ${segment.id} references a station missing from the layout: ${segment.to_station}`,
        );
      }
      return `<line x1="${safeCoord(from.x)}" y1="${safeCoord(from.y)}" x2="${safeCoord(to.x)}" y2="${safeCoord(to.y)}" stroke="black" stroke-width="4" />`;
    })
    .join("\n  ");

  const circles = layout.stations
    .map((pos) => {
      const name = stationNameById.get(pos.station_id) ?? pos.station_id;
      return `<circle cx="${safeCoord(pos.x)}" cy="${safeCoord(pos.y)}" r="6" fill="white" stroke="black" stroke-width="2"><title>${escapeXml(name)}</title></circle>`;
    })
    .join("\n  ");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000">
  ${lines}
  ${circles}
</svg>`;
}

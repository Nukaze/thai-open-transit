import type { Station, Line, Segment } from "schema";

interface NetworkForValidation {
  stations: Station[];
  lines: Line[];
  segments: Segment[];
}

export function checkSourceRefs(network: NetworkForValidation): string[] {
  const violations: string[] = [];
  const entities: { id: string; milestones: Station["milestones"] }[] = [
    ...network.stations,
    ...network.lines,
    ...network.segments,
  ];
  for (const entity of entities) {
    entity.milestones.forEach((milestone, index) => {
      if (milestone.source_refs.length === 0) {
        violations.push(
          `${entity.id}: milestone[${index}] (${milestone.event}) has empty source_refs`,
        );
      }
    });
  }
  return violations;
}

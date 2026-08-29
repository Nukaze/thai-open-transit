import type { Station } from 'schema';

export function resolveInterchangeGroups(stations: Station[]): Map<string, string[]> {
  const groups = new Map<string, string[]>();
  for (const station of stations) {
    if (!station.interchange_group) continue;
    if (!groups.has(station.interchange_group)) groups.set(station.interchange_group, []);
    groups.get(station.interchange_group)!.push(station.id);
  }
  return groups;
}

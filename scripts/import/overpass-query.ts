/**
 * Builds an Overpass QL query for rail transit route relations within a
 * bounding box. Targets light_rail (BTS Skytrain, monorails), subway
 * (MRT), and any relation tagged route=train that also carries a
 * network tag matching SRT's urban Red Line service - long-distance SRT
 * services do not carry route=light_rail/subway and are excluded by this
 * query's route filter (see plan's "Explicitly out of scope" scope call).
 */
export function buildOverpassQuery(
  bbox: [number, number, number, number],
): string {
  const [minLat, minLon, maxLat, maxLon] = bbox;
  return `[out:json][timeout:60][bbox:${minLat},${minLon},${maxLat},${maxLon}];
relation[type="route"][route~"light_rail|subway|monorail"];
out body;
>;
out skel qt;`;
}

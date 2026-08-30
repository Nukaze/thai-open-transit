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
  // `out body` on the recursed members, not `out skel`: skel emits geometry
  // with the tags stripped, which loses exactly the fields an entity needs -
  // `name`, `name:en` and the station code in `ref`. The first import used
  // skel and produced 4166 elements of which zero carried tags, so the
  // extract had coordinates but no identities.
  return `[out:json][timeout:90][bbox:${minLat},${minLon},${maxLat},${maxLon}];
relation[type="route"][route~"light_rail|subway|monorail"];
out body;
>;
out body qt;`;
}

/**
 * Builds an Overpass QL query for the rail transit route relations that feed
 * data/source/osm-raw.json: light_rail (BTS Skytrain, monorails), subway
 * (MRT) and monorail.
 *
 * This query deliberately does NOT cover the SRT Red Lines or the Airport Rail
 * Link: those are tagged route=train, which the filter below never matches.
 * They come from `buildTrainQuery` and land in a separate file, so re-running
 * this import never has to be mixed with the train extract.
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

/**
 * `network` values that identify urban rail services tagged route=train.
 * Verified against live OSM on 2026-10-06 (overpass-api.de, bbox of the
 * Bangkok region, all route=train|light_rail relations):
 *
 *  - SRT Dark Red Line: relations 13058384 (Bang Sue to Rangsit) and 13058390
 *    (Rangsit to Bang Sue); network="รถไฟฟ้าชานเมือง สายสีแดง", operator=SRTET.
 *  - SRT Light Red Line: relations 13178788 (Bang Sue to Taling Chan) and
 *    14071495 (Taling Chan to Bang Sue); same network value.
 *  - Airport Rail Link: relations 2148241 and 9921500; network="ARL".
 *
 * Long-distance and commuter SRT services are also route=train but carry other
 * network values and are excluded by matching on `network`, not `route` alone:
 * the "Bangkok Connex" 9001-9006 relations (20513473 and others,
 * network="Bangkok Connex") and the SRT Mahachai/Thonburi commuter relations
 * (20088142, 21259101, 21259162, network="การรถไฟแห่งประเทศไทย").
 */
export const URBAN_TRAIN_NETWORKS = [
  "รถไฟฟ้าชานเมือง สายสีแดง",
  "ARL",
] as const;

/**
 * Overpass QL for the SRT Dark/Light Red Lines and Airport Rail Link route
 * relations. Same `out body` / recursion shape as `buildOverpassQuery`.
 *
 * The `network` match is anchored (`^(...)$`) so a longer network name that
 * merely contains "ARL" cannot slip in.
 */
export function buildTrainQuery(
  bbox: [number, number, number, number],
): string {
  const [minLat, minLon, maxLat, maxLon] = bbox;
  const networks = URBAN_TRAIN_NETWORKS.join("|");
  return `[out:json][timeout:90][bbox:${minLat},${minLon},${maxLat},${maxLon}];
relation[type="route"][route="train"][network~"^(${networks})$"];
out body;
>;
out body qt;`;
}

// Bounding box covers Bangkok + Nonthaburi + Samut Prakan + Pathum Thani,
// per CLAUDE.md 9: "Assuming the network is inside Bangkok province" is a
// pitfall - the network spans four provinces.
const BANGKOK_REGION_BOUNDS = {
  minLat: 13.4,
  maxLat: 14.2,
  minLon: 100.2,
  maxLon: 100.95,
};

export function isWithinBangkokRegion(lat: number, lon: number): boolean {
  return (
    lat >= BANGKOK_REGION_BOUNDS.minLat &&
    lat <= BANGKOK_REGION_BOUNDS.maxLat &&
    lon >= BANGKOK_REGION_BOUNDS.minLon &&
    lon <= BANGKOK_REGION_BOUNDS.maxLon
  );
}

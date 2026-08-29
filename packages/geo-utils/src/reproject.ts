import proj4 from 'proj4';

// EPSG:24047 - Indian 1975 / UTM zone 47N. Thailand's historical geodetic
// datum, still the source datum on older MRTA/SRT/RTSD published station
// coordinate documents. Definition per https://epsg.io/24047.proj4
const INDIAN_1975_UTM_47N =
  '+proj=utm +zone=47 +ellps=evrst30 +towgs84=293,836,318,0.5,1.6,-2.8,2.1 +units=m +no_defs +type=crs';

proj4.defs('EPSG:24047', INDIAN_1975_UTM_47N);

export function toWgs84FromIndian1975Utm47N(
  easting: number,
  northing: number,
): { lat: number; lon: number } {
  const [lon, lat] = proj4('EPSG:24047', 'EPSG:4326', [easting, northing]);
  return { lat, lon };
}

export function fromWgs84ToIndian1975Utm47N(
  lat: number,
  lon: number,
): { easting: number; northing: number } {
  const [easting, northing] = proj4('EPSG:4326', 'EPSG:24047', [lon, lat]);
  return { easting, northing };
}

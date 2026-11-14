const EARTH_KM = 6371.0088;
const toRad = (degrees) => degrees * Math.PI / 180;
const toDeg = (radians) => radians * 180 / Math.PI;
const numberOrNull = (value) => value !== null && value !== '' && Number.isFinite(Number(value)) ? Number(value) : null;

export function bearingDistance(origin, target) {
  const lat1 = toRad(origin.latitude);
  const lat2 = toRad(target.latitude);
  const dLat = lat2 - lat1;
  const dLon = toRad(target.longitude - origin.longitude);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  const distanceKm = EARTH_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return { distanceKm, bearingDeg: (toDeg(Math.atan2(y, x)) + 360) % 360 };
}

export function normalizeAircraft(raw, origin) {
  const latitude = numberOrNull(raw?.lat);
  const longitude = numberOrNull(raw?.lon);
  if (latitude === null || longitude === null || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  const position = { latitude, longitude };
  const polar = bearingDistance(origin, position);
  const id = String(raw.hex || raw.icao || 'UNKNOWN').trim().toUpperCase();
  const callsign = String(raw.flight || raw.callsign || '').trim().toUpperCase() || id;
  return {
    id,
    callsign,
    registration: String(raw.r || raw.registration || '').trim().toUpperCase(),
    type: String(raw.t || raw.type || '').trim().toUpperCase(),
    latitude,
    longitude,
    altitudeFt: numberOrNull(raw.alt_baro === 'ground' ? 0 : raw.alt_baro ?? raw.altitude),
    speedKt: numberOrNull(raw.gs ?? raw.speed),
    headingDeg: numberOrNull(raw.track ?? raw.heading),
    verticalRateFpm: numberOrNull(raw.baro_rate ?? raw.vert_rate),
    squawk: String(raw.squawk || '').trim(),
    ...polar,
  };
}

const clean = (value) => {
  const result = String(value ?? '').trim();
  return result || null;
};

export function buildAircraftDetail(base = {}, enrichment = {}) {
  const metadata = enrichment.aircraft || {};
  const routeData = enrichment.route || {};
  const origin = routeData.origin || {};
  const destination = routeData.destination || {};
  const originCode = clean(origin.iata_code || origin.icao_code);
  const destinationCode = clean(destination.iata_code || destination.icao_code);
  return {
    callsign: clean(base.callsign),
    icao: clean(base.id),
    registration: clean(metadata.registration || base.registration),
    aircraftModel: clean(metadata.type || base.type),
    icaoType: clean(metadata.icao_type || base.type),
    manufacturer: clean(metadata.manufacturer),
    owner: clean(metadata.registered_owner),
    airline: clean(routeData.airline?.name),
    route: originCode && destinationCode ? `${originCode} → ${destinationCode}` : null,
    originName: clean(origin.name),
    destinationName: clean(destination.name),
    altitudeFt: numberOrNull(base.altitudeFt),
    speedKt: numberOrNull(base.speedKt),
    headingDeg: numberOrNull(base.headingDeg),
    verticalRateFpm: numberOrNull(base.verticalRateFpm),
    squawk: clean(base.squawk),
    latitude: numberOrNull(base.latitude),
    longitude: numberOrNull(base.longitude),
    distanceKm: numberOrNull(base.distanceKm),
    bearingDeg: numberOrNull(base.bearingDeg),
  };
}


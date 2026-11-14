const STORAGE_KEY = 'spectrumlink.preferences.v7';
const LEGACY_STORAGE_KEYS = ['spectrumlink.preferences.v6', 'spectrumlink.preferences.v5', 'spectrumlink.preferences.v4', 'spectrumlink.preferences.v3'];
const SUPPORTED_LOCALES = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko', 'es', 'fr', 'de', 'pt', 'ru', 'ar', 'hi'];

export const DEFAULT_PREFERENCES = Object.freeze({
  locale: 'zh-CN',
  nickname: 'RADIO OPERATOR',
  callsignPrimary: 'CALLSIGN',
  callsignSecondary: 'UV-K1 LAB',
  location: '太原',
  bio: '无线电与航空爱好者',
  callsignColor: '#ffad2f',
  callsignSize: 54,
  locationColor: '#ffad2f',
  locationSize: 16,
  avatar: '',
  latitude: 37.825044,
  longitude: 112.517125,
  radarRadiusNm: 250,
  terrainMode: 'open3d',
  signalThresholdDb: 12,
});

const text = (value, fallback, max) => typeof value === 'string' && value.trim()
  ? value.trim().slice(0, max)
  : fallback;
const optionalText = (value, fallback, max) => typeof value === 'string' ? value.trim().slice(0, max) : fallback;
const boundedNumber = (value, fallback, min, max) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, Math.round(number))) : fallback;
};
const safeColor = (value, fallback) => /^#[0-9a-f]{6}$/i.test(value || '') ? value.toLowerCase() : fallback;

function sanitize(value = {}) {
  const latitude = Number(value.latitude);
  const longitude = Number(value.longitude);
  const radius = Number(value.radarRadiusNm);
  const avatar = typeof value.avatar === 'string' && /^data:image\/(png|jpeg|webp);base64,/i.test(value.avatar)
    ? value.avatar
    : DEFAULT_PREFERENCES.avatar;
  return {
    locale: SUPPORTED_LOCALES.includes(value.locale) ? value.locale : DEFAULT_PREFERENCES.locale,
    nickname: text(value.nickname, DEFAULT_PREFERENCES.nickname, 24),
    callsignPrimary: text(value.callsignPrimary, DEFAULT_PREFERENCES.callsignPrimary, 12).toUpperCase(),
    callsignSecondary: optionalText(value.callsignSecondary, DEFAULT_PREFERENCES.callsignSecondary, 18).toUpperCase(),
    location: optionalText(value.location, DEFAULT_PREFERENCES.location, 16),
    bio: optionalText(value.bio, DEFAULT_PREFERENCES.bio, 80),
    callsignColor: safeColor(value.callsignColor, DEFAULT_PREFERENCES.callsignColor),
    callsignSize: boundedNumber(value.callsignSize, DEFAULT_PREFERENCES.callsignSize, 32, 88),
    locationColor: safeColor(value.locationColor, DEFAULT_PREFERENCES.locationColor),
    locationSize: boundedNumber(value.locationSize, DEFAULT_PREFERENCES.locationSize, 12, 32),
    avatar,
    latitude: Number.isFinite(latitude) && latitude >= -90 && latitude <= 90 ? latitude : DEFAULT_PREFERENCES.latitude,
    longitude: Number.isFinite(longitude) && longitude >= -180 && longitude <= 180 ? longitude : DEFAULT_PREFERENCES.longitude,
    radarRadiusNm: Number.isFinite(radius) && radius >= 5 && radius <= 250 ? Math.round(radius) : DEFAULT_PREFERENCES.radarRadiusNm,
    terrainMode: ['local3d', 'open3d', 'flat2d'].includes(value.terrainMode) ? value.terrainMode : DEFAULT_PREFERENCES.terrainMode,
    signalThresholdDb: boundedNumber(value.signalThresholdDb, DEFAULT_PREFERENCES.signalThresholdDb, 6, 30),
  };
}

export function loadPreferences(storage = globalThis.localStorage) {
  try {
    const current = storage?.getItem(STORAGE_KEY);
    if (current) return sanitize(JSON.parse(current));
    const legacy = LEGACY_STORAGE_KEYS.map((key) => storage?.getItem(key)).find(Boolean);
    if (!legacy) return { ...DEFAULT_PREFERENCES };
    const migrated = sanitize(JSON.parse(legacy));
    if (migrated.terrainMode === 'local3d') migrated.terrainMode = 'open3d';
    return migrated;
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

export function savePreferences(storage = globalThis.localStorage, value) {
  const preferences = sanitize(value);
  storage?.setItem(STORAGE_KEY, JSON.stringify(preferences));
  return preferences;
}


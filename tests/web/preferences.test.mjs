import assert from 'node:assert/strict';
import test from 'node:test';

import { DEFAULT_PREFERENCES, loadPreferences, savePreferences } from '../../web/src/preferences.js';

function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
    read: (key) => data.get(key),
  };
}

test('preferences use safe instrument-dashboard defaults when storage is absent or corrupt', () => {
  assert.deepEqual(loadPreferences(memoryStorage()), DEFAULT_PREFERENCES);
  assert.deepEqual(loadPreferences(memoryStorage({ 'spectrumlink.preferences.v3': '{bad' })), DEFAULT_PREFERENCES);
  assert.equal(DEFAULT_PREFERENCES.latitude, 37.825044);
  assert.equal(DEFAULT_PREFERENCES.longitude, 112.517125);
  assert.equal(DEFAULT_PREFERENCES.radarRadiusNm, 250);
  assert.equal(DEFAULT_PREFERENCES.callsignColor, '#ffad2f');
  assert.equal(DEFAULT_PREFERENCES.callsignSize, 54);
  assert.equal(DEFAULT_PREFERENCES.locationColor, '#ffad2f');
  assert.equal(DEFAULT_PREFERENCES.locationSize, 16);
  assert.equal(DEFAULT_PREFERENCES.terrainMode, 'open3d');
  assert.equal(DEFAULT_PREFERENCES.locale, 'zh-CN');
  assert.equal(DEFAULT_PREFERENCES.signalThresholdDb, 12);
});

test('RF activity sensitivity is persisted and clamped to a useful range', () => {
  assert.equal(savePreferences(memoryStorage(), { ...DEFAULT_PREFERENCES, signalThresholdDb: 16 }).signalThresholdDb, 16);
  assert.equal(savePreferences(memoryStorage(), { ...DEFAULT_PREFERENCES, signalThresholdDb: 2 }).signalThresholdDb, 6);
  assert.equal(savePreferences(memoryStorage(), { ...DEFAULT_PREFERENCES, signalThresholdDb: 80 }).signalThresholdDb, 30);
  assert.equal(savePreferences(memoryStorage(), { ...DEFAULT_PREFERENCES, signalThresholdDb: 'bad' }).signalThresholdDb, 12);
});

test('preferences persist supported languages and fall back to simplified Chinese', () => {
  assert.equal(savePreferences(memoryStorage(), { ...DEFAULT_PREFERENCES, locale: 'ja' }).locale, 'ja');
  assert.equal(savePreferences(memoryStorage(), { ...DEFAULT_PREFERENCES, locale: 'ar' }).locale, 'ar');
  assert.equal(savePreferences(memoryStorage(), { ...DEFAULT_PREFERENCES, locale: 'xx-invalid' }).locale, 'zh-CN');
});

test('terrain mode defaults to real keyless 3D and only accepts supported backends', () => {
  assert.equal(savePreferences(memoryStorage(), { ...DEFAULT_PREFERENCES, terrainMode: 'local3d' }).terrainMode, 'local3d');
  assert.equal(savePreferences(memoryStorage(), { ...DEFAULT_PREFERENCES, terrainMode: 'open3d' }).terrainMode, 'open3d');
  assert.equal(savePreferences(memoryStorage(), { ...DEFAULT_PREFERENCES, terrainMode: 'flat2d' }).terrainMode, 'flat2d');
  assert.equal(savePreferences(memoryStorage(), { ...DEFAULT_PREFERENCES, terrainMode: 'google-without-key' }).terrainMode, 'open3d');
});

test('the old procedural default migrates to real terrain without losing identity settings', () => {
  const preferences = loadPreferences(memoryStorage({
    'spectrumlink.preferences.v6': JSON.stringify({ ...DEFAULT_PREFERENCES, nickname: '鸽子TechLife', terrainMode: 'local3d' }),
  }));
  assert.equal(preferences.nickname, '鸽子TechLife');
  assert.equal(preferences.terrainMode, 'open3d');
});

test('preferences sanitize text, coordinates, radius and avatar data', () => {
  const storage = memoryStorage({
    'spectrumlink.preferences.v3': JSON.stringify({
      nickname: '  山鹰  ', callsignPrimary: 'bg1abc ', callsignSecondary: '   ', location: '  太原  ', bio: '  无线电与航空爱好者  ',
      latitude: 999, longitude: 121.47, radarRadiusNm: 400,
      avatar: 'https://tracker.invalid/avatar.png',
    }),
  });
  assert.deepEqual(loadPreferences(storage), {
    ...DEFAULT_PREFERENCES,
    nickname: '山鹰', callsignPrimary: 'BG1ABC', callsignSecondary: '', location: '太原', bio: '无线电与航空爱好者', longitude: 121.47,
  });
});

test('preferences allow the optional secondary callsign, city and introduction to stay blank', () => {
  const saved = savePreferences(memoryStorage(), { ...DEFAULT_PREFERENCES, callsignSecondary: '', location: '', bio: '' });
  assert.equal(saved.callsignSecondary, '');
  assert.equal(saved.location, '');
  assert.equal(saved.bio, '');
});

test('saved preferences round trip through the same sanitization rules', () => {
  const storage = memoryStorage();
  const saved = savePreferences(storage, {
    ...DEFAULT_PREFERENCES,
    nickname: '  Operator ', callsignPrimary: ' ba7xyz ', radarRadiusNm: 80,
    avatar: 'data:image/png;base64,AA==',
  });
  assert.equal(saved.nickname, 'Operator');
  assert.equal(saved.callsignPrimary, 'BA7XYZ');
  assert.equal(saved.radarRadiusNm, 80);
  assert.equal(loadPreferences(storage).avatar, 'data:image/png;base64,AA==');
});

test('callsign color accepts six-digit hex and rejects unsafe CSS values', () => {
  assert.equal(savePreferences(memoryStorage(), { ...DEFAULT_PREFERENCES, callsignColor: '#35FF82' }).callsignColor, '#35ff82');
  assert.equal(savePreferences(memoryStorage(), { ...DEFAULT_PREFERENCES, callsignColor: 'url(javascript:bad)' }).callsignColor, '#ffad2f');
  assert.equal(savePreferences(memoryStorage(), { ...DEFAULT_PREFERENCES, callsignColor: '#fff' }).callsignColor, '#ffad2f');
});

test('identity display preferences clamp city and callsign sizes and sanitize both colors', () => {
  const saved = savePreferences(memoryStorage(), {
    ...DEFAULT_PREFERENCES,
    callsignSize: 500,
    locationSize: 4,
    callsignColor: '#35FF82',
    locationColor: '#45A0FF',
  });
  assert.equal(saved.callsignSize, 88);
  assert.equal(saved.locationSize, 12);
  assert.equal(saved.callsignColor, '#35ff82');
  assert.equal(saved.locationColor, '#45a0ff');
  const fallback = savePreferences(memoryStorage(), {
    ...DEFAULT_PREFERENCES,
    callsignSize: Number.NaN,
    locationSize: Number.NaN,
    locationColor: 'url(javascript:bad)',
  });
  assert.equal(fallback.callsignSize, 54);
  assert.equal(fallback.locationSize, 16);
  assert.equal(fallback.locationColor, '#ffad2f');
});


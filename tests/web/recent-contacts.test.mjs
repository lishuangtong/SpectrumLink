import assert from 'node:assert/strict';
import test from 'node:test';

import {
  formatContactDateTime,
  loadRecentContacts,
  normalizeRecentContacts,
  saveRecentContacts,
  upsertRecentContact,
} from '../../web/src/recent-contacts.js';

test('normalizeRecentContacts sanitizes callsign, QTH and clock time for the ticker', () => {
  assert.deepEqual(normalizeRecentContacts([
    { callsign: ' bd3sai ', qth: ' 太原 ', date: '2026-11-07', time: '00:42' },
    { callsign: 'bh3rfx<script>', qth: '', date: '2026-13-40', time: '25:90' },
  ]), [
    { callsign: 'BD3SAI', qth: '太原', date: '2026-11-07', time: '00:42' },
    { callsign: 'BH3RFXSCRIPT', qth: '未知 QTH', date: '', time: '--:--' },
  ]);
});

test('normalizeRecentContacts drops rows without a callsign and bounds the list', () => {
  const rows = Array.from({ length: 20 }, (_, index) => ({ callsign: index === 0 ? '' : `BG3${index}`, qth: '山西', time: '12:30' }));
  const result = normalizeRecentContacts(rows);
  assert.equal(result.length, 12);
  assert.equal(result[0].callsign, 'BG31');
  assert.equal(result.at(-1).callsign, 'BG312');
});

test('contact date and time render as a compact combined timestamp', () => {
  assert.equal(formatContactDateTime({ date: '2026-11-07', time: '00:42' }), '11-07 00:42');
  assert.equal(formatContactDateTime({ date: '', time: '--:--' }), '-- -- --:--');
});

test('contacts persist locally and corrupt storage falls back safely', () => {
  const values = new Map();
  const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  const rows = saveRecentContacts(storage, [{ callsign: 'bd3sai', qth: '太原', date: '2026-11-07', time: '18:30' }]);
  assert.deepEqual(loadRecentContacts(storage), rows);
  values.set('spectrumlink.recentContacts.v1', '{bad json');
  assert.deepEqual(loadRecentContacts(storage, [{ callsign: 'BG3UPT', qth: '忻州', date: '2026-11-06', time: '20:10' }]), [
    { callsign: 'BG3UPT', qth: '忻州', date: '2026-11-06', time: '20:10' },
  ]);
});

test('contact editor replaces an existing row or prepends a new one', () => {
  const rows = [{ callsign: 'BD3SAI', qth: '太原', date: '2026-11-07', time: '18:30' }];
  assert.equal(upsertRecentContact(rows, { callsign: 'BH3RFX', qth: '晋中', date: '2026-11-07', time: '19:00' }, 0)[0].callsign, 'BH3RFX');
  assert.equal(upsertRecentContact(rows, { callsign: 'BG3UPT', qth: '忻州', date: '2026-11-07', time: '19:10' })[0].callsign, 'BG3UPT');
});

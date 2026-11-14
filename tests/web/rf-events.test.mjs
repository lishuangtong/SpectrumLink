import assert from 'node:assert/strict';
import test from 'node:test';

import { appendRfEvent, formatRfEvent, loadRfEvents, saveRfEvents } from '../../web/src/rf-events.js';

function memoryStorage() {
  const data = new Map();
  return { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
}

test('RF events persist sanitized measurements and newest event first', () => {
  const storage = memoryStorage();
  const rows = saveRfEvents(storage, [
    { startedAt: 1000, endedAt: 2600, frequencyHz: 145_500_000, peakDbm: -72, durationMs: 1600 },
  ]);
  assert.deepEqual(loadRfEvents(storage), rows);
  const next = appendRfEvent(rows, { startedAt: 3000, endedAt: 4100, frequencyHz: 439_875_000, peakDbm: -86, durationMs: 1100 });
  assert.equal(next[0].frequencyHz, 439_875_000);
  assert.equal(next.length, 2);
});

test('RF event history is bounded and rejects malformed rows', () => {
  const rows = Array.from({ length: 140 }, (_, index) => ({
    startedAt: index + 1, endedAt: index + 2, frequencyHz: 145_000_000 + index, peakDbm: -90, durationMs: 1,
  }));
  const result = appendRfEvent(rows, { startedAt: 999, endedAt: 1000, frequencyHz: 439_875_000, peakDbm: -70, durationMs: 1 });
  assert.equal(result.length, 100);
  assert.deepEqual(appendRfEvent(result, { frequencyHz: Number.NaN }), result);
});

test('RF event formatter exposes date, frequency, peak and duration without calling it speech', () => {
  const formatted = formatRfEvent({ startedAt: Date.UTC(2026, 10, 9, 2, 3), frequencyHz: 145_500_000, peakDbm: -72, durationMs: 1650 });
  assert.match(formatted.dateTime, /11-09/);
  assert.equal(formatted.frequency, '145.5000 MHz');
  assert.equal(formatted.peak, '-72 dBm');
  assert.equal(formatted.duration, '1.7 s');
  assert.doesNotMatch(JSON.stringify(formatted), /讲话|语音|speech/i);
});


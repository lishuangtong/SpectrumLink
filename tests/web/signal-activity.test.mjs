import assert from 'node:assert/strict';
import test from 'node:test';

import { createSignalActivityDetector, estimateNoiseFloor, findTopPeaks } from '../../web/src/signal-activity.js';

function sweep(bins, sequence = 1) {
  const values = Int16Array.from(bins);
  let peakIndex = 0;
  values.forEach((value, index) => { if (value > values[peakIndex]) peakIndex = index; });
  return { sequence, centerHz: 145_500_000, stepHz: 6_250, peakIndex, bins: values };
}

test('adaptive noise floor ignores a few strong carriers', () => {
  const bins = Array(64).fill(-112);
  bins[10] = -70; bins[31] = -65; bins[52] = -80;
  assert.equal(estimateNoiseFloor(bins), -112);
});

test('detector rejects flat noise and activates only after two qualifying sweeps', () => {
  const detector = createSignalActivityDetector({ thresholdDb: 12, releaseMs: 500 });
  const quiet = sweep(Array(64).fill(-110));
  assert.equal(detector.update(quiet, 0).active, false);

  const signal = Array(64).fill(-120); signal[40] = -105;
  assert.equal(detector.update(sweep(signal, 2), 100).active, false);
  const active = detector.update(sweep(signal, 3), 200);
  assert.equal(active.active, true);
  assert.equal(active.frequencyHz, 145_550_000);
  assert.equal(active.peakDbm, -105);
});

test('S9 carrier uses a guarded strong-signal path when it is less than 12 dB above noise', () => {
  const detector = createSignalActivityDetector({ thresholdDb: 12, releaseMs: 500 });
  const bins = Array(64).fill(-96);
  bins[32] = -88;
  const active = detector.update(sweep(bins, 1), 0);
  assert.equal(active.active, true);
  assert.equal(active.peakDbm, -88);
});

test('authoritative S9 peak activates on a low-contrast real-radio sweep', () => {
  const detector = createSignalActivityDetector({ thresholdDb: 12, releaseMs: 500 });
  const bins = Array.from({ length: 64 }, (_, index) => -91 + (index % 3));
  bins[32] = -88;
  const active = detector.update(sweep(bins, 1), 0);
  assert.equal(active.active, true);
  assert.equal(active.frequencyHz, 145_500_000);
  assert.equal(active.peakDbm, -88);
});

test('strong-signal path still rejects a raised flat noise floor', () => {
  const detector = createSignalActivityDetector({ thresholdDb: 12, releaseMs: 500 });
  const raisedNoise = Array(64).fill(-88);
  detector.update(sweep(raisedNoise, 1), 0);
  assert.equal(detector.update(sweep(raisedNoise, 2), 100).active, false);
});

test('detector holds the event for 500ms and emits one completed event', () => {
  const detector = createSignalActivityDetector({ thresholdDb: 12, releaseMs: 500 });
  const loud = Array(64).fill(-110); loud[32] = -75;
  const quiet = sweep(Array(64).fill(-110), 3);
  detector.update(sweep(loud, 1), 0);
  detector.update(sweep(loud, 2), 100);
  assert.equal(detector.update(quiet, 300).active, true);
  const ended = detector.update(quiet, 701);
  assert.equal(ended.active, false);
  assert.equal(ended.completedEvent.frequencyHz, 145_500_000);
  assert.equal(ended.completedEvent.peakDbm, -75);
  assert.equal(ended.completedEvent.durationMs, 701);
  assert.equal(detector.update(quiet, 900).completedEvent, null);
});

test('top peaks collapse adjacent bins and return strongest separated carriers', () => {
  const bins = Array(64).fill(-112);
  bins[9] = -88; bins[10] = -65; bins[11] = -70;
  bins[31] = -78; bins[32] = -72; bins[33] = -80;
  bins[51] = -82; bins[52] = -74; bins[53] = -81;
  bins[60] = -108;
  const peaks = findTopPeaks(sweep(bins), { thresholdDb: 12, limit: 3, minSeparationBins: 4 });
  assert.deepEqual(peaks.map(({ bin, dbm }) => [bin, dbm]), [[10, -65], [32, -72], [52, -74]]);
  assert.equal(peaks[0].frequencyHz, 145_362_500);
});


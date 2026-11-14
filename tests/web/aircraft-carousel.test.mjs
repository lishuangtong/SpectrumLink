import assert from 'node:assert/strict';
import test from 'node:test';

import { AIRCRAFT_CAROUSEL_INTERVAL_MS, AIRCRAFT_TRANSITION_MS, aircraftModelProfile, aircraftPose, createAircraftTransitionController, essentialAircraftFacts, nextAircraftId, shouldAdvanceAircraftCarousel } from '../../web/src/aircraft-carousel.js';

const planes = [
  { id: 'A00001', callsign: 'CCA1279' },
  { id: 'A00002', callsign: 'CDG1161' },
  { id: 'A00003', callsign: 'CES9871' },
];

test('nextAircraftId advances through live aircraft and wraps without inventing a target', () => {
  assert.equal(nextAircraftId(planes, null), 'A00001');
  assert.equal(nextAircraftId(planes, 'A00001'), 'A00002');
  assert.equal(nextAircraftId(planes, 'A00003'), 'A00001');
  assert.equal(nextAircraftId([], 'A00001'), null);
});

test('carousel waits for the current real model before advancing to another aircraft', () => {
  const ready = { hidden: false, pausedUntil: 0, now: 10, count: 3, modalOpen: false, modelLoading: false };
  assert.equal(shouldAdvanceAircraftCarousel(ready), true);
  assert.equal(shouldAdvanceAircraftCarousel({ ...ready, modelLoading: true }), false);
  assert.equal(shouldAdvanceAircraftCarousel({ ...ready, count: 1 }), false);
  assert.equal(shouldAdvanceAircraftCarousel({ ...ready, pausedUntil: 20 }), false);
  assert.equal(shouldAdvanceAircraftCarousel({ ...ready, modalOpen: true }), false);
});

test('carousel holds each aircraft for fifteen seconds', () => {
  assert.equal(AIRCRAFT_CAROUSEL_INTERVAL_MS, 15_000);
});

test('aircraft transition eases out before swapping data and eases the new aircraft in', () => {
  const classes = new Set();
  const stage = { classList: { add: (name) => classes.add(name), remove: (name) => classes.delete(name) } };
  const timers = [];
  const cleared = new Set();
  const controller = createAircraftTransitionController({
    stage,
    setTimeoutFn(fn, delay) { const id = timers.length; timers.push({ fn, delay }); return id; },
    clearTimeoutFn(id) { cleared.add(id); },
  });
  let swaps = 0;
  controller.transition(() => { swaps += 1; });
  assert.equal(AIRCRAFT_TRANSITION_MS, 700);
  assert.equal(classes.has('is-switching-out'), true);
  assert.equal(swaps, 0);
  assert.equal(timers[0].delay, 280);
  timers[0].fn();
  assert.equal(swaps, 1);
  assert.equal(classes.has('is-switching-out'), false);
  assert.equal(classes.has('is-switching-in'), true);
  assert.equal(timers[1].delay, 420);
  timers[1].fn();
  assert.equal(classes.has('is-switching-in'), false);
  assert.equal(cleared.size, 0);
});

test('essentialAircraftFacts returns only available operational parameters', () => {
  assert.deepEqual(essentialAircraftFacts({
    id: '781EC5', callsign: 'CCA1279', registration: '', type: 'AJ27',
    altitudeFt: 27600, speedKt: 358, headingDeg: 275, verticalRateFpm: null,
    distanceKm: 278.4, bearingDeg: 19.2,
  }), [
    ['ICAO', '781EC5'], ['机型', 'AJ27'], ['高度', '27,600 ft'], ['地速', '358 kt'],
    ['航向', '275°'], ['距离 / 方位', '278 km · 19°'],
  ]);
  assert.deepEqual(essentialAircraftFacts({ id: 'ABC123', altitudeFt: null, speedKt: null, headingDeg: null, distanceKm: null, bearingDeg: null }), [['ICAO', 'ABC123']]);
});

test('aircraftPose maps telemetry to a bounded 3D presentation pose', () => {
  assert.deepEqual(aircraftPose({ headingDeg: 275, verticalRateFpm: 2400 }), { yaw: 275, pitch: -8, bank: 12 });
  assert.deepEqual(aircraftPose({ headingDeg: null, verticalRateFpm: -5000 }), { yaw: 0, pitch: 8, bank: -12 });
});

test('aircraftModelProfile selects geometry and exact names from ICAO type codes', () => {
  assert.deepEqual(aircraftModelProfile('B738'), { family: 'b737', name: 'Boeing 737-800', length: 1, span: 1 });
  assert.deepEqual(aircraftModelProfile('A21N'), { family: 'a320', name: 'Airbus A321neo', length: 1.08, span: .96 });
  assert.deepEqual(aircraftModelProfile('AJ27'), { family: 'arj21', name: 'COMAC ARJ21-700', length: .9, span: .82 });
  assert.deepEqual(aircraftModelProfile('AT76'), { family: 'turboprop', name: 'ATR 72-600', length: .86, span: .92 });
  assert.deepEqual(aircraftModelProfile('ZZZZ'), { family: 'generic', name: 'ZZZZ', length: 1, span: 1 });
});

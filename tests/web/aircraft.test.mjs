import assert from 'node:assert/strict';
import test from 'node:test';

import { bearingDistance, buildAircraftDetail, normalizeAircraft } from '../../web/src/aircraft.js';

const origin = { latitude: 37.825044, longitude: 112.517125 };

test('bearingDistance returns stable range and bearing for a known offset', () => {
  const result = bearingDistance({ latitude: 0, longitude: 0 }, { latitude: 1, longitude: 0 });
  assert.ok(Math.abs(result.distanceKm - 111.195) < 0.02);
  assert.ok(Math.abs(result.bearingDeg) < 0.01);
});

test('normalizeAircraft filters missing positions and normalizes partial readsb records', () => {
  assert.equal(normalizeAircraft({ hex: 'abc123' }, origin), null);
  const aircraft = normalizeAircraft({
    hex: '780abc', flight: ' csn8910 ', lat: 31.4, lon: 121.8,
    alt_baro: 9625, gs: 288, track: 353, baro_rate: -320, r: 'B-1234', t: 'A320',
  }, origin);
  assert.equal(aircraft.id, '780ABC');
  assert.equal(aircraft.callsign, 'CSN8910');
  assert.equal(aircraft.registration, 'B-1234');
  assert.equal(aircraft.type, 'A320');
  assert.equal(aircraft.altitudeFt, 9625);
  assert.equal(aircraft.speedKt, 288);
  assert.equal(aircraft.headingDeg, 353);
  assert.ok(aircraft.distanceKm > 0);
  assert.ok(aircraft.bearingDeg >= 0 && aircraft.bearingDeg < 360);
});

test('buildAircraftDetail combines live telemetry with real aircraft and route metadata', () => {
  const base = normalizeAircraft({ hex: '780c3d', flight: 'CSN8910', lat: 37.9, lon: 112.8, alt_baro: 9625, gs: 288, track: 353, r: 'B-1829', t: 'A320' }, origin);
  const detail = buildAircraftDetail(base, {
    aircraft: { type: 'A320 232SL', icao_type: 'A320', manufacturer: 'Airbus', registration: 'B-1829', registered_owner: 'China Southern Airlines' },
    route: { airline: { name: 'China Southern Airlines' }, origin: { iata_code: 'SYX', name: 'Sanya Phoenix International Airport' }, destination: { iata_code: 'PKX', name: 'Beijing Daxing International Airport' } },
  });
  assert.equal(detail.manufacturer, 'Airbus');
  assert.equal(detail.aircraftModel, 'A320 232SL');
  assert.equal(detail.owner, 'China Southern Airlines');
  assert.equal(detail.airline, 'China Southern Airlines');
  assert.equal(detail.route, 'SYX → PKX');
  assert.equal(detail.altitudeFt, 9625);
  assert.equal(detail.speedKt, 288);
});

test('buildAircraftDetail keeps honest missing-data markers instead of inventing values', () => {
  const detail = buildAircraftDetail({ id: 'ABC123', callsign: 'ABC123', latitude: 37, longitude: 112, distanceKm: 2, bearingDeg: 5 }, {});
  assert.equal(detail.aircraftModel, null);
  assert.equal(detail.route, null);
  assert.equal(detail.airline, null);
  assert.equal(detail.altitudeFt, null);
});


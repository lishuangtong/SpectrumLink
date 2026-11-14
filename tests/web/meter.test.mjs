import assert from 'node:assert/strict';
import test from 'node:test';

import * as meterRenderer from '../../web/src/render-meter.js';

const { dbmToMeter, digitalMeterLayout, digitalMeterTextY, meterFrame, meterNeedleAngle } = meterRenderer;

test('dbmToMeter follows the VHF/UHF standard of S9 at -93 dBm and six dB per S-unit', () => {
  assert.deepEqual(dbmToMeter(-141), { s: 1, over: 0, label: 'S1', ratio: 0 });
  assert.equal(dbmToMeter(-135).label, 'S2');
  assert.equal(dbmToMeter(-93).label, 'S9');
  assert.equal(dbmToMeter(-83).label, 'S9+10');
  assert.equal(dbmToMeter(-73).label, 'S9+20');
  assert.equal(dbmToMeter(-33).label, 'S9+60');
  assert.equal(dbmToMeter(-20).ratio, 1);
});

test('analog meter uses a full rectangular illuminated window', () => {
  assert.deepEqual(meterFrame(300, 180), { x: 8, y: 8, width: 284, height: 164 });
});

test('meterNeedleAngle clamps the sweep to the mechanical meter arc', () => {
  assert.equal(meterNeedleAngle(-200), -55);
  assert.equal(meterNeedleAngle(-141), -55);
  assert.equal(meterNeedleAngle(-20), 55);
  assert.ok(meterNeedleAngle(-93) > 0);
});

test('digital meter labels keep an upper safety margin on short iPad panels', () => {
  assert.deepEqual(digitalMeterTextY(80), { label: 54, dbm: 52 });
  assert.deepEqual(digitalMeterTextY(38), { label: 18, dbm: 18 });
});

test('digital S-unit text sits above the light bar instead of overlapping it', () => {
  const layout = digitalMeterLayout(38);
  assert.equal(layout.labelY, 18);
  assert.ok(layout.barY >= 26);
  assert.ok(layout.labelY < layout.barY);
});

test('digital bar smooths small RSSI changes without exaggerating them', () => {
  assert.equal(typeof meterRenderer.nextMeterState, 'function');
  const initial = meterRenderer.nextMeterState(null, -91);
  assert.deepEqual(initial, { displayDbm: -91 });
  const speaking = meterRenderer.nextMeterState(initial, -89);
  assert.ok(speaking.displayDbm > -91 && speaking.displayDbm < -89, 'a 2 dB rise should be smoothed and never amplified past the input');
  const release = meterRenderer.nextMeterState(speaking, -91);
  assert.ok(release.displayDbm > -91, 'the bar should fall back more slowly than it rises');
  assert.ok(release.displayDbm < speaking.displayDbm, 'the bar should still move toward the lower reading');
  assert.deepEqual(meterRenderer.nextMeterState(initial, -89), speaking, 'ballistics must be deterministic, never random');
});


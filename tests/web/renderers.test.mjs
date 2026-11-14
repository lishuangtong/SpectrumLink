import assert from 'node:assert/strict';
import test from 'node:test';

import * as render2d from '../../web/src/render-2d.js';
import * as waterfall from '../../web/src/render-waterfall.js';
import * as render3d from '../../web/src/render-3d.js';

const { axisFont, frequencyAtBin, peakMarkerGeometry } = render2d;
const { eventMarkerGeometry, paletteColor, sampleWaterfallBin } = waterfall;
const { projectPoint } = render3d;

test('frequencyAtBin follows the radio half-open 64-bin grid', () => {
  const sweep = { centerHz: 145_500_000, stepHz: 6_250 };
  assert.equal(frequencyAtBin(sweep, 0), 145_300_000);
  assert.equal(frequencyAtBin(sweep, 32), 145_500_000);
  assert.equal(frequencyAtBin(sweep, 63), 145_693_750);
});

test('narrow spectrum panels use compact axis labels', () => {
  assert.equal(axisFont(300), '8px ui-monospace, monospace');
  assert.equal(axisFont(500), '11px ui-monospace, monospace');
});

test('frequency ticks stay sparse in a compact panel and become dense when enlarged', () => {
  assert.equal(typeof render2d.frequencyAxisTicks, 'function');
  const sweep = { centerHz: 439_806_250, stepHz: 6_250 };
  assert.deepEqual(render2d.frequencyAxisTicks(sweep, 300).map(({ bin, label }) => ({ bin, label })), [
    { bin: 0, label: '439.606' },
    { bin: 63, label: '440.000' },
  ]);
  assert.equal(render2d.frequencyAxisTicks(sweep, 800).length, 9);
});

test('SDR auto range maps a real K1 noise floor to blue and a carrier to hot colors', () => {
  assert.equal(typeof waterfall.sdrDisplayRange, 'function');
  const bins = Int8Array.from({ length: 64 }, (_, index) => index === 21 ? -72 : -94);
  assert.deepEqual(waterfall.sdrDisplayRange(bins), { floor: -97, ceiling: -70 });
  const noise = paletteColor(-94, -97, -70);
  const carrier = paletteColor(-72, -97, -70);
  assert.ok(noise[2] > 120 && noise[0] < 30, 'noise floor should stay dark blue');
  assert.ok(carrier[0] > 200 && carrier[1] < 180, 'carrier should be red-hot');
});

test('older 3D history traces are quieter than the current SDR trace', () => {
  assert.equal(typeof render3d.spectrum3dOpacity, 'function');
  assert.ok(render3d.spectrum3dOpacity(1, true) > render3d.spectrum3dOpacity(1, false));
  assert.ok(render3d.spectrum3dOpacity(.55, false) < .4);
});

test('palette maps quiet floor through hot peaks with clamped endpoints', () => {
  assert.deepEqual(paletteColor(-200, -120, -40), [4, 10, 40]);
  assert.deepEqual(paletteColor(-120, -120, -40), [4, 10, 40]);
  assert.deepEqual(paletteColor(-40, -120, -40), [255, 255, 255]);
  assert.deepEqual(paletteColor(20, -120, -40), [255, 255, 255]);
  const middle = paletteColor(-80, -120, -40);
  assert.ok(middle[0] > 200, 'mid-strength waterfall energy should already be yellow-orange');
  assert.ok(middle[1] > 140);
  assert.ok(middle[2] < 100);
});

test('waterfall interpolates the 64 radio bins into dense SDR-style columns', () => {
  const bins = Int8Array.from({ length: 64 }, (_, index) => index - 120);
  assert.equal(sampleWaterfallBin(bins, 0), -120);
  assert.equal(sampleWaterfallBin(bins, 1), -57);
  assert.equal(sampleWaterfallBin(bins, .5), -88.5);
});

test('live spectrum peak markers are positioned from their bin and signal level', () => {
  const marker = peakMarkerGeometry({ bin: 32, dbm: -70, frequencyHz: 145_500_000 }, {
    width: 640, height: 240, floor: -120, ceiling: -40,
  });
  assert.equal(marker.x, 340);
  assert.equal(marker.label, 'P1 145.5000');
  assert.ok(marker.y > 16 && marker.y < 212);
});

test('waterfall event markers map event time and frequency into chart coordinates', () => {
  const rows = [
    { receivedAt: 1000, centerHz: 145_500_000, stepHz: 6_250 },
    { receivedAt: 2000, centerHz: 145_500_000, stepHz: 6_250 },
    { receivedAt: 3000, centerHz: 145_500_000, stepHz: 6_250 },
  ];
  const marker = eventMarkerGeometry({ endedAt: 2000, frequencyHz: 145_500_000, peakDbm: -72 }, rows, 640, 300);
  assert.deepEqual(marker, { x: 320, y: 150, label: '-72 dBm' });
  assert.equal(eventMarkerGeometry({ endedAt: 500, frequencyHz: 145_500_000, peakDbm: -72 }, rows, 640, 300), null);
  assert.equal(eventMarkerGeometry({ endedAt: 2000, frequencyHz: 433_000_000, peakDbm: -72 }, rows, 640, 300), null);
});

test('3D projection keeps coordinates finite and pushes older rows upward/back', () => {
  const front = projectPoint(32, 0, 0.8, 800, 400, { perspective: 0.72, verticalScale: 1 });
  const back = projectPoint(32, 80, 0.8, 800, 400, { perspective: 0.72, verticalScale: 1 });
  assert.ok(Object.values(front).every(Number.isFinite));
  assert.ok(Object.values(back).every(Number.isFinite));
  assert.ok(back.y < front.y);
  assert.ok(back.scale < front.scale);
});


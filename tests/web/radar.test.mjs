import assert from 'node:assert/strict';
import test from 'node:test';

import { projectAircraft, radarGeometry, radarVisualLayers, renderRadar, shouldLabelAircraft, shouldRenderRadar } from '../../web/src/render-radar.js';

test('projectAircraft maps north/east/south/west to the correct circular radar quadrants', () => {
  const center = { x: 100, y: 100 };
  assert.deepEqual(projectAircraft({ distanceKm: 50, bearingDeg: 0 }, 100, center, 80), { x: 100, y: 60 });
  assert.deepEqual(projectAircraft({ distanceKm: 50, bearingDeg: 90 }, 100, center, 80), { x: 140, y: 100 });
  assert.deepEqual(projectAircraft({ distanceKm: 50, bearingDeg: 180 }, 100, center, 80), { x: 100, y: 140 });
  assert.deepEqual(projectAircraft({ distanceKm: 50, bearingDeg: 270 }, 100, center, 80), { x: 60, y: 100 });
});

test('radarGeometry drops out-of-range targets and returns selectable hit regions', () => {
  const geometry = radarGeometry([
    { id: 'A', callsign: 'ALPHA', distanceKm: 20, bearingDeg: 45, headingDeg: 90 },
    { id: 'B', callsign: 'BRAVO', distanceKm: 120, bearingDeg: 180, headingDeg: 0 },
  ], { width: 300, height: 240, radiusKm: 80 });
  assert.equal(geometry.targets.length, 1);
  assert.equal(geometry.targets[0].aircraft.id, 'A');
  assert.equal(geometry.targets[0].hitRadius, 14);
  assert.ok(geometry.radarRadius > 50);
});

test('radar paints its first frame immediately and throttles later frames', () => {
  assert.equal(shouldRenderRadar(0, null), true);
  assert.equal(shouldRenderRadar(40, 20), false);
  assert.equal(shouldRenderRadar(100, 0), true);
});

test('radarVisualLayers exposes map, grid, range rings and segmented bezel geometry', () => {
  const layers = radarVisualLayers(320, 280);
  assert.equal(layers.rings.length, 4);
  assert.equal(layers.bezelSegments.length, 20);
  assert.ok(layers.landmasses.length >= 5);
  assert.ok(layers.gridLines.length >= 10);
  assert.equal(layers.center.x, 160);
  assert.equal(layers.center.y, 140);
});

test('radar still draws targets when conic gradients are unavailable', () => {
  const gradient = { addColorStop() {} };
  const ctx = {
    canvas: { clientWidth: 240, clientHeight: 200 },
    createRadialGradient: () => gradient,
    createConicGradient: () => { throw new Error('unsupported'); },
    fillRect() {}, beginPath() {}, arc() {}, stroke() {}, moveTo() {}, lineTo() {}, fill() {}, fillText() {}, save() {}, restore() {}, translate() {}, rotate() {}, closePath() {}, clip() {}, strokeRect() {},
  };
  const targets = renderRadar(ctx, [{ id: 'A', callsign: 'ALPHA', distanceKm: 10, bearingDeg: 45, headingDeg: 90 }], { radiusKm: 80, time: 0 });
  assert.equal(targets.length, 1);
});

test('selected radar target is painted with a square acquisition lock', () => {
  const gradient = { addColorStop() {} };
  let lockBoxes = 0;
  const ctx = {
    canvas: { clientWidth: 240, clientHeight: 200 },
    createRadialGradient: () => gradient,
    createConicGradient: () => gradient,
    fillRect() {}, beginPath() {}, arc() {}, stroke() {}, moveTo() {}, lineTo() {}, fill() {}, fillText() {}, save() {}, restore() {}, translate() {}, rotate() {}, closePath() {}, clip() {},
    strokeRect() { lockBoxes += 1; },
  };
  renderRadar(ctx, [{ id: 'A', callsign: 'ALPHA', distanceKm: 10, bearingDeg: 45, headingDeg: 90 }], { radiusKm: 80, selectedId: 'A', time: 0 });
  assert.equal(lockBoxes, 1);
});

test('compact radar labels only the selected aircraft to prevent collisions', () => {
  assert.equal(shouldLabelAircraft({ id: 'A' }, 'A'), true);
  assert.equal(shouldLabelAircraft({ id: 'B' }, 'A'), false);
});


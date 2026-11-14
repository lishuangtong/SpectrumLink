import assert from 'node:assert/strict';
import test from 'node:test';

import { aircraftCameraPreset, DEFAULT_AIRCRAFT_ORIENTATION, dragAircraftOrientation, localTerrainHeight, modelCreditText, modelFitScale } from '../../web/src/aircraft-3d.js';
import { createAircraftMeshSpec } from '../../web/src/aircraft-3d-spec.js';

test('createAircraftMeshSpec produces distinct real 3D proportions and engine layouts', () => {
  assert.deepEqual(createAircraftMeshSpec({ family: 'a320', length: 1.08, span: .96 }), {
    fuselageLength: 5.94, wingspan: 6.24, wingChord: 1.38, engineLayout: 'underwing', engineCount: 2,
  });
  assert.deepEqual(createAircraftMeshSpec({ family: 'arj21', length: .9, span: .82 }), {
    fuselageLength: 4.32, wingspan: 4.43, wingChord: 1.08, engineLayout: 'rear', engineCount: 2,
  });
  assert.deepEqual(createAircraftMeshSpec({ family: 'turboprop', length: .86, span: .92 }), {
    fuselageLength: 4.13, wingspan: 5.52, wingChord: 1.15, engineLayout: 'propeller', engineCount: 2,
  });
});

test('offline terrain is a real height field with repeatable mountain relief', () => {
  assert.equal(localTerrainHeight(2.5, -1.25), localTerrainHeight(2.5, -1.25));
  const samples = [];
  let steepestQuarterStep = 0;
  for (let x = -18; x <= 18; x += .5) for (let z = -14; z <= 14; z += .5) {
    const height = localTerrainHeight(x, z);
    samples.push(height);
    steepestQuarterStep = Math.max(
      steepestQuarterStep,
      Math.abs(localTerrainHeight(x + .25, z) - height),
      Math.abs(localTerrainHeight(x, z + .25) - height),
    );
  }
  assert.ok(Math.max(...samples) - Math.min(...samples) > 7, 'terrain needs alpine relief, not smooth green hills');
  assert.ok(steepestQuarterStep > .45, 'terrain needs sharp ridges and gullies that catch real mountain light');
});

test('model credit stays honest while loading and after procedural fallback', () => {
  const asset = { label: 'FR24 A330-300', license: 'GPL-2.0' };
  assert.equal(modelCreditText(asset, 'loading'), '正在加载 FR24 A330-300 · 当前显示程序化后备模型');
  assert.equal(modelCreditText(asset, 'fr24'), 'FR24 A330-300 · GPL-2.0 · 可拖动查看');
  assert.equal(modelCreditText(asset, 'procedural'), '程序化后备模型 · 可拖动查看');
  assert.equal(modelCreditText(null, 'procedural'), '程序化后备模型 · 可拖动查看');
});

test('modelFitScale fills the scenic stage while bounding very large and tiny models', () => {
  assert.equal(modelFitScale({ x: 80, y: 24, z: 72 }), 0.0875);
  assert.equal(modelFitScale({ x: 0, y: 0, z: 0 }), 7);
  assert.equal(modelFitScale({ x: 2, y: 1, z: 1 }), 3.5);
});

test('aircraft starts at a fixed 45 degree pose and only manual dragging changes it', () => {
  assert.deepEqual(DEFAULT_AIRCRAFT_ORIENTATION, { yaw: -Math.PI / 4, pitch: Math.PI / 4 });
  assert.deepEqual(dragAircraftOrientation(DEFAULT_AIRCRAFT_ORIENTATION, 0, 0), DEFAULT_AIRCRAFT_ORIENTATION);
  const rotated = dragAircraftOrientation(DEFAULT_AIRCRAFT_ORIENTATION, 100, -25);
  assert.equal(rotated.yaw, -Math.PI / 4 + 1.2);
  assert.equal(rotated.pitch, Math.PI / 4 - .2);
  const fullTurn = dragAircraftOrientation(DEFAULT_AIRCRAFT_ORIENTATION, Math.PI * 2 / .012, 0);
  assert.ok(Math.abs(fullTurn.yaw - (DEFAULT_AIRCRAFT_ORIENTATION.yaw + Math.PI * 2)) < 1e-12);
});

test('full-screen aircraft camera pulls back enough to keep the complete airframe visible', () => {
  assert.deepEqual(aircraftCameraPreset(1010), { fov: 36, position: [10.4, 5.8, 12.2] });
  assert.deepEqual(aircraftCameraPreset(300), { fov: 29, position: [6.2, 3.4, 7.3] });
});

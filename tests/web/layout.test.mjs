import assert from 'node:assert/strict';
import test from 'node:test';

import { clampDragPosition, loadModuleLayout, normalizePosition, saveModuleLayout } from '../../web/src/layout.js';

function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
}

test('drag position is clamped inside the dashboard canvas', () => {
  const bounds = { width: 1000, height: 700 };
  const module = { width: 250, height: 300 };
  assert.deepEqual(clampDragPosition(-20, 900, bounds, module), { x: 0, y: 400 });
  assert.deepEqual(clampDragPosition(500, 200, bounds, module), { x: 500, y: 200 });
});

test('normalized module positions survive viewport size changes', () => {
  assert.deepEqual(normalizePosition({ x: 375, y: 200 }, { width: 1000, height: 700 }, { width: 250, height: 300 }), { x: .5, y: .5 });
});

test('layout storage rejects corrupt and out-of-range module positions', () => {
  assert.deepEqual(loadModuleLayout(memoryStorage({ 'spectrumlink.layout.v1': '{bad' })), {});
  const storage = memoryStorage();
  const saved = saveModuleLayout(storage, { terrain: { x: .25, y: .5 }, radar: { x: 2, y: -1 }, bad: null });
  assert.deepEqual(saved, { terrain: { x: .25, y: .5 } });
  assert.deepEqual(loadModuleLayout(storage), saved);
});


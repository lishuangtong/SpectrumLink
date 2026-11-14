import assert from 'node:assert/strict';
import test from 'node:test';

import { createTerrainStyle, shouldFallbackTerrain, terrainCamera, terrainPresentationCamera } from '../../web/src/terrain-map.js';

test('terrain camera centers the live 3D scene on the configured radio coordinates', () => {
  assert.deepEqual(terrainCamera({ longitude: 112.517125, latitude: 37.825044 }), {
    center: [112.517125, 37.825044], zoom: 8.6, pitch: 70, bearing: -28,
  });
});

test('overhead aircraft shot looks vertically down at the real ground below the selected flight', () => {
  assert.deepEqual(terrainPresentationCamera({
    longitude: 112.62, latitude: 37.91, heading: 205, shotId: 'overhead',
  }), {
    center: [112.62, 37.91], zoom: 9.7, pitch: 58, bearing: 205,
  });
  const flyBy = terrainPresentationCamera({ longitude: 112.62, latitude: 37.91, heading: 205, shotId: 'fly-by' });
  assert.ok(flyBy.pitch >= 68);
  assert.equal(flyBy.center[0], 112.62);
});

test('terrain style combines attributed satellite imagery with open elevation data', () => {
  const style = createTerrainStyle();
  assert.deepEqual(style.layers[0], {
    id: 'sky-ground',
    type: 'background',
    paint: { 'background-color': '#07120f' },
  });
  assert.equal(style.sources.imagery.type, 'raster');
  assert.equal(style.sources.imagery.tiles[0], '/api/imagery/{z}/{x}/{y}.jpeg');
  assert.match(style.sources.imagery.attribution, /NASA/);
  assert.equal(style.sources.terrain.type, 'raster-dem');
  assert.equal(style.sources.terrain.url, '/api/terrain/tilejson.json');
  assert.equal(style.sources.terrainHillshade.url, '/api/terrain/tilejson.json');
  assert.match(style.sources.terrain.attribution, /Mapterhorn/);
  assert.deepEqual(style.terrain, { source: 'terrain', exaggeration: 1.15 });
});

test('terrain fallback ignores isolated tile errors and only trips before a successful load', () => {
  assert.equal(shouldFallbackTerrain(1, false), false);
  assert.equal(shouldFallbackTerrain(3, false), false);
  assert.equal(shouldFallbackTerrain(4, false), true);
  assert.equal(shouldFallbackTerrain(20, true), false);
});

import assert from 'node:assert/strict';
import test from 'node:test';

import { aircraftModelAsset } from '../../web/src/aircraft-model-assets.js';

test('aircraftModelAsset routes common family codes to lightweight AMV models', () => {
  assert.deepEqual(aircraftModelAsset('A320'), {
    provider: 'amvlab',
    filename: 'A320_nologo.glb',
    sourceUrl: 'https://cdn.jsdelivr.net/gh/amvlab/aircraft-models@91d835e8e851b2317fe79af291c9fed6153fd525/models/A320_nologo.glb',
    sourcePage: 'https://github.com/amvlab/aircraft-models',
    license: 'CC BY 4.0',
    label: 'AMV Lab A320',
    match: 'exact',
  });
  assert.equal(aircraftModelAsset('A380').provider, 'amvlab');
  assert.equal(aircraftModelAsset('B787').filename, 'B787_nologo.glb');
});

test('aircraftModelAsset routes specialist types to Gods Eye View models', () => {
  assert.equal(aircraftModelAsset('B789').filename, 'b789.glb');
  assert.equal(aircraftModelAsset('B789').provider, 'gods-eye-view');
  assert.equal(aircraftModelAsset('AT76').filename, 'atr72.glb');
  assert.equal(aircraftModelAsset('C172').filename, 'c172.glb');
  assert.equal(aircraftModelAsset('B747').filename, 'airplane.glb');
});

test('aircraftModelAsset maps exact ICAO variants to the matching FR24 GLB', () => {
  assert.deepEqual(aircraftModelAsset('A333'), {
    provider: 'fr24',
    filename: 'a333.glb',
    sourceUrl: 'https://ghproxy.net/https://raw.githubusercontent.com/Flightradar24/fr24-3d-models/dd53267690c6a4ecbb290a3acf0284333a5d68a9/models/a333.glb',
    sourcePage: 'https://github.com/Flightradar24/fr24-3d-models',
    license: 'GPL-2.0',
    label: 'FR24 A330-300',
    match: 'exact',
  });
  assert.equal(aircraftModelAsset('b738').filename, 'b738.glb');
  assert.equal(aircraftModelAsset('DH8D').filename, 'q400.glb');
  assert.equal(aircraftModelAsset('E190').provider, 'fr24');
});

test('aircraftModelAsset uses declared family models for aliases without accepting paths', () => {
  assert.equal(aircraftModelAsset('A20N').label, 'AMV Lab A320 family');
  assert.equal(aircraftModelAsset('A20N').match, 'family');
  assert.equal(aircraftModelAsset('A19N').filename, 'A320_nologo.glb');
  assert.equal(aircraftModelAsset('A388').filename, 'A380_nologo.glb');
  assert.equal(aircraftModelAsset('B38M').filename, 'B737_nologo.glb');
  assert.equal(aircraftModelAsset('B39M').filename, 'B737_nologo.glb');
  assert.equal(aircraftModelAsset('B78X').filename, 'B787_nologo.glb');
  assert.equal(aircraftModelAsset('B77W').filename, 'b773.glb');
  assert.equal(aircraftModelAsset('E195').filename, 'e190.glb');
  assert.equal(aircraftModelAsset('E75L').filename, 'e170.glb');
  assert.equal(aircraftModelAsset('E75S').filename, 'e170.glb');
  assert.equal(aircraftModelAsset('A3ST').filename, 'beluga.glb');
  assert.equal(aircraftModelAsset('A124'), null);
  assert.equal(aircraftModelAsset('C919'), null);
  assert.equal(aircraftModelAsset('../../a320'), null);
  assert.equal(aircraftModelAsset(''), null);
});

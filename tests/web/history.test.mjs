import assert from 'node:assert/strict';
import test from 'node:test';

import { SpectrumHistory } from '../../web/src/history.js';

function sweep(sequence, value, { centerHz = 145_500_000, stepHz = 6_250 } = {}) {
  return {
    sequence,
    centerHz,
    stepHz,
    peakIndex: 0,
    flags: 0,
    bins: new Int16Array(64).fill(value),
  };
}

test('history validates 64 bins, clamps dBm, and does not mutate input', () => {
  const history = new SpectrumHistory({ depth: 4 });
  assert.throws(() => history.append({ ...sweep(0, -90), bins: new Int8Array(63) }), /64 bins/i);
  const source = sweep(0, 40);
  source.bins[1] = -200;
  history.append(source);

  assert.equal(history.latest.bins[0], 0);
  assert.equal(history.latest.bins[1], -128);
  assert.equal(source.bins[0], 40);
  assert.equal(source.bins[1], -200);
});

test('history keeps oldest-to-newest ring order and truncates on depth changes', () => {
  const history = new SpectrumHistory({ depth: 3 });
  for (let sequence = 0; sequence < 5; sequence += 1) history.append(sweep(sequence, -100 + sequence));
  assert.deepEqual(history.rows.map((row) => row.sequence), [2, 3, 4]);

  history.setDepth(2);
  assert.deepEqual(history.rows.map((row) => row.sequence), [3, 4]);
  assert.throws(() => history.setDepth(257), /256/);
});

test('history resets rows and peak hold when frequency geometry changes', () => {
  const history = new SpectrumHistory({ depth: 8 });
  history.append(sweep(0, -60));
  history.append(sweep(1, -70, { centerHz: 146_000_000 }));
  assert.equal(history.rows.length, 1);
  assert.equal(history.latest.centerHz, 146_000_000);
  assert.equal(history.peakHold[0], -70);
});

test('peak hold attacks immediately and decays one dB per sweep', () => {
  const history = new SpectrumHistory({ depth: 8 });
  history.append(sweep(0, -80));
  history.append(sweep(1, -50));
  assert.equal(history.peakHold[0], -50);
  history.append(sweep(2, -90));
  assert.equal(history.peakHold[0], -51);
});

test('long sessions remain bounded and sequence gaps do not create rows', () => {
  const history = new SpectrumHistory({ depth: 32 });
  for (let sequence = 0; sequence < 100_000; sequence += 1) {
    history.append(sweep(sequence & 0xffff, -100 + (sequence % 8)));
  }
  assert.equal(history.rows.length, 32);
  assert.equal(new Set(history.rows.map((row) => row.bins.buffer)).size, 32);

  const rowsBeforeGap = history.rows.length;
  history.append(sweep((history.latest.sequence + 4) & 0xffff, -70));
  assert.equal(history.rows.length, rowsBeforeGap);
  assert.equal(history.diagnostics.sequenceGaps, 1);
});


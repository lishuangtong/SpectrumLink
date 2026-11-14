import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

test('distribution verifier accepts the built SpectrumLink artifact', () => {
  const result = spawnSync('bash', ['scripts/verify-dist.sh'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /PASS name: SpectrumLink/);
  assert.match(result.stdout, /PASS API minimum: 3/);
  assert.match(result.stdout, /PASS capability: serial/);
  assert.match(result.stdout, /PASS CRC-32/);
});


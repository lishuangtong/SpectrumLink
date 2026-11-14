import assert from 'node:assert/strict';
import { stat } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const projectRoot = new URL('../', import.meta.url);
const apiHeader = new URL('../.cache/f4hwn-v6.3.0/App/apps/app_api.h', import.meta.url);

function runFetch() {
  return spawnSync('bash', ['scripts/fetch-f4hwn.sh'], {
    cwd: projectRoot,
    encoding: 'utf8',
  });
}

test('fetch script installs the pinned F4HWN API and is idempotent', async () => {
  const first = runFetch();
  assert.equal(first.status, 0, first.stderr || first.stdout);

  const before = await stat(apiHeader);
  const second = runFetch();
  assert.equal(second.status, 0, second.stderr || second.stdout);
  const after = await stat(apiHeader);

  assert.equal(after.ino, before.ino, 'second run replaced the verified tree');
  assert.match(second.stdout, /already verified/i);
});

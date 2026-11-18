import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);

async function readOptional(path) {
  try {
    return await readFile(new URL(path, root), 'utf8');
  } catch {
    return '';
  }
}

test('package metadata identifies the public release without enabling npm publication', async () => {
  const pkg = JSON.parse(await readFile(new URL('package.json', root), 'utf8'));
  const [dashboard, notice, security] = await Promise.all([
    readFile(new URL('web/index.html', root), 'utf8'),
    readFile(new URL('NOTICE', root), 'utf8'),
    readFile(new URL('SECURITY.md', root), 'utf8'),
  ]);

  assert.equal(pkg.version, '3.8.0');
  assert.equal(pkg.license, 'GPL-2.0-or-later');
  assert.equal(pkg.private, true);
  assert.match(pkg.description, /UV-K1/i);
  assert.equal(pkg.homepage, 'https://www.lishuangtong.com');
  assert.deepEqual(pkg.repository, {
    type: 'git',
    url: 'git+https://github.com/lishuangtong/SpectrumLink.git',
  });
  assert.equal(pkg.bugs.url, 'https://github.com/lishuangtong/SpectrumLink/issues');
  assert.deepEqual(pkg.engines, { node: '>=20' });
  assert.match(dashboard, /Version：v3\.8\.0/);
  assert.match(notice, /SpectrumLink v3\.8\.0/);
  assert.match(security, /v3\.8\.0/);
});

test('local metadata, credentials, dependencies and compiled apps stay outside Git', () => {
  const ignored = ['.DS_Store', '.env', '.env.local', 'node_modules', 'dist/SpectrumLink.app'];

  for (const path of ignored) {
    const output = execFileSync('git', ['check-ignore', '--no-index', '--quiet', path], {
      cwd: root,
      stdio: 'ignore',
    });
    assert.equal(output, null, `${path} must be ignored`);
  }

  const trackedApp = execFileSync('git', ['ls-files', 'dist/SpectrumLink.app'], {
    cwd: root,
    encoding: 'utf8',
  }).trim();
  assert.equal(trackedApp, '', 'compiled SpectrumLink.app must be a release asset, not a tracked source file');
});

test('public release includes licensing, attribution, contribution and safety documents', async () => {
  const required = [
    'LICENSE',
    'NOTICE',
    'CONTRIBUTING.md',
    'CODE_OF_CONDUCT.md',
    'SECURITY.md',
  ];

  const documents = await Promise.all(
    required.map(async (path) => [path, await readFile(new URL(path, root), 'utf8')]),
  );
  for (const [path, content] of documents) {
    assert.ok(content.trim().length > 200, `${path} must contain a usable public document`);
  }

  assert.match(documents[0][1], /GNU GENERAL PUBLIC LICENSE/);
  assert.match(documents[1][1], /FR24 3D Models/);
  assert.match(documents[1][1], /MapLibre GL JS/);
  assert.match(documents[1][1], /Three\.js/);
});

test('README identifies the author and states the radio and ADS-B boundaries', async () => {
  const readme = await readFile(new URL('README.md', root), 'utf8');

  assert.match(readme, /v3\.8\.0/);
  assert.match(readme, /鸽子TechLife/);
  assert.match(readme, /https:\/\/www\.lishuangtong\.com/);
  assert.match(readme, /64 点 RSSI/);
  assert.match(readme, /不提供 I\/Q/);
  assert.match(readme, /ADS-B.*K1.*独立/s);
  assert.doesNotMatch(readme, /demo targets/i);
});

test('GitHub automation tests a clean firmware build and offers structured reports', async () => {
  const workflow = await readFile(new URL('.github/workflows/ci.yml', root), 'utf8');
  const bug = await readFile(new URL('.github/ISSUE_TEMPLATE/bug_report.yml', root), 'utf8');
  const feature = await readFile(new URL('.github/ISSUE_TEMPLATE/feature_request.yml', root), 'utf8');
  const config = await readFile(new URL('.github/ISSUE_TEMPLATE/config.yml', root), 'utf8');
  const pullRequest = await readFile(new URL('.github/pull_request_template.md', root), 'utf8');

  assert.match(workflow, /npm ci/);
  assert.ok(
    workflow.indexOf('npm run build:app') < workflow.indexOf('npm test'),
    'CI must build the ignored release artifact before the full test suite',
  );
  assert.match(workflow, /permissions:\s*\n\s+contents: read/);
  assert.match(bug, /实机/);
  assert.match(feature, /问题|目标/);
  assert.match(config, /blank_issues_enabled: false/);
  assert.match(pullRequest, /npm test/);
});

test('public repository ships a secure one-click Docker deployment for Baota, NAS and Linux', async () => {
  const [dockerfile, compose, dockerignore, install, update, guide, workflow] = await Promise.all([
    readOptional('Dockerfile'),
    readOptional('compose.yaml'),
    readOptional('.dockerignore'),
    readOptional('deploy/install.sh'),
    readOptional('deploy/update.sh'),
    readOptional('docs/deploy-baota-nas.md'),
    readOptional('.github/workflows/container.yml'),
  ]);

  assert.match(dockerfile, /npm ci --omit=dev/);
  assert.match(dockerfile, /USER node/);
  assert.match(dockerfile, /HEALTHCHECK/);
  assert.match(compose, /ghcr\.io\/lishuangtong\/spectrumlink/);
  assert.match(compose, /read_only:\s*true/);
  assert.match(compose, /no-new-privileges:true/);
  assert.match(compose, /cap_drop:[\s\S]*ALL/);
  assert.match(dockerignore, /node_modules/);
  assert.match(install, /docker compose/);
  assert.match(update, /docker compose pull/);
  assert.match(guide, /宝塔/);
  assert.match(guide, /NAS/);
  assert.match(guide, /HTTPS/);
  assert.match(guide, /Web Serial/);
  assert.match(workflow, /linux\/amd64,linux\/arm64/);
  assert.match(workflow, /packages: write/);
});

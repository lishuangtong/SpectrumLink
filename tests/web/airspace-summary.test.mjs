import assert from 'node:assert/strict';
import test from 'node:test';

import { buildAirspaceSummary, createLatestRequestGuard, formatAirspaceSummary } from '../../web/src/airspace-summary.js';

test('airspace summary derives count, nearest aircraft and highest altitude', () => {
  const updatedAt = new Date('2026-11-09T12:42:16.000Z');
  const summary = buildAirspaceSummary([
    { callsign: 'GCR7856', distanceKm: 69.4, altitudeFt: 24500 },
    { callsign: 'CCA4107', distanceKm: 120.2, altitudeFt: 39000 },
    { callsign: 'BAD', distanceKm: Number.NaN, altitudeFt: Number.NaN },
  ], { latencyMs: 1180, updatedAt, status: 'live' });

  assert.deepEqual(summary, {
    status: 'live',
    count: 3,
    nearestCallsign: 'GCR7856',
    nearestDistanceKm: 69.4,
    highestAltitudeFt: 39000,
    latencyMs: 1180,
    updatedAt,
  });
});

test('airspace summary remains explicit and finite while waiting or unavailable', () => {
  assert.deepEqual(buildAirspaceSummary([], { status: 'loading' }), {
    status: 'loading',
    count: 0,
    nearestCallsign: null,
    nearestDistanceKm: null,
    highestAltitudeFt: null,
    latencyMs: null,
    updatedAt: null,
  });

  const unavailable = buildAirspaceSummary([
    { callsign: '', distanceKm: 'bad', altitudeFt: Infinity },
  ], { latencyMs: -5, updatedAt: 'bad', status: 'error' });
  assert.equal(unavailable.status, 'error');
  assert.equal(unavailable.count, 1);
  assert.equal(unavailable.nearestCallsign, null);
  assert.equal(unavailable.nearestDistanceKm, null);
  assert.equal(unavailable.highestAltitudeFt, null);
  assert.equal(unavailable.latencyMs, null);
  assert.equal(unavailable.updatedAt, null);
});

test('airspace summary rejects null and blank numeric fields instead of treating them as zero', () => {
  const summary = buildAirspaceSummary([
    { callsign: 'EMPTY', distanceKm: null, altitudeFt: '' },
    { callsign: 'BLANK', distanceKm: '   ', altitudeFt: undefined },
  ], { latencyMs: null, updatedAt: null, status: 'error' });

  assert.equal(summary.nearestCallsign, null);
  assert.equal(summary.nearestDistanceKm, null);
  assert.equal(summary.highestAltitudeFt, null);
  assert.equal(summary.latencyMs, null);
});

test('formatted failure status never presents a false zero latency or stale update time', () => {
  const t = (key, values = {}) => ({
    'airspace.countValue': `${values.count} 架`,
    'airspace.waiting': '等待数据',
    'airspace.unavailable': '不可用',
    'airspace.updated': '更新',
    'airspace.pendingUpdate': '等待更新',
    'airspace.interrupted': '连接中断',
  }[key] ?? key);
  const text = formatAirspaceSummary(buildAirspaceSummary([], { status: 'error' }), { t, locale: 'zh-CN' });

  assert.deepEqual(text, {
    count: '--',
    nearest: '不可用',
    highest: '-- ft',
    latency: '--',
    updated: '连接中断',
  });
});

test('latest request guard rejects both stale success and stale failure completions', () => {
  const guard = createLatestRequestGuard();
  const first = guard.begin();
  const second = guard.begin();

  assert.equal(guard.isCurrent(first), false);
  assert.equal(guard.isCurrent(second), true);
});

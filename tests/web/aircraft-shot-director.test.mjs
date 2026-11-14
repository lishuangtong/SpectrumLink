import assert from 'node:assert/strict';
import test from 'node:test';

import {
  AIRCRAFT_SHOT_CYCLE_MS,
  aircraftControlPhase,
  aircraftFlightMotion,
  aircraftShotFrame,
} from '../../web/src/aircraft-shot-director.js';

test('fifteen-second timeline visits fly-by, complete 45-degree, engine-detail and overhead shots in order', () => {
  assert.equal(AIRCRAFT_SHOT_CYCLE_MS, 15_000);
  assert.equal(aircraftShotFrame(0).fromId, 'fly-by');
  assert.ok(aircraftShotFrame(0).cameraPosition[2] < -7, 'fly-by camera must be in front of the nose, not behind the aircraft');
  assert.ok(aircraftShotFrame(0).fov >= 34, 'fly-by keeps the nose and both engines readable before exiting frame');
  assert.ok(aircraftShotFrame(0).stageOffset[0] >= 2, 'fly-by starts inside the right side of the window before exiting left');
  assert.ok(aircraftShotFrame(1_000).stageOffset[0] > .8, 'fly-by keeps the cockpit visible through the opening beat');
  assert.ok(aircraftShotFrame(0).stageOffset[0] > aircraftShotFrame(3_000).stageOffset[0], 'fly-by moves toward the edge of frame');
  const full = aircraftShotFrame(3_900);
  assert.equal(full.fromId, 'full-45');
  assert.deepEqual(full.cameraPosition, [10.4, 5.8, 12.2]);
  assert.ok(Math.hypot(...full.cameraPosition) > 16, 'full-airframe camera needs a safe framing distance');
  assert.ok(full.fov >= 38, '45-degree shot needs enough field of view for the complete aircraft');
  assert.ok(Math.abs(full.pitch) < .25, '45 degrees describes the viewing azimuth, not a steep climb attitude');
  assert.equal(full.yaw, 0, 'the diagonal camera supplies the 45-degree view without turning the nose toward it');
  assert.equal(aircraftShotFrame(7_700).fromId, 'engine-detail');
  assert.equal(aircraftShotFrame(11_400).fromId, 'overhead');
  assert.ok(aircraftShotFrame(11_400).cameraPosition[1] > 12, 'overhead shot looks down from above the complete aircraft');
  assert.equal(aircraftShotFrame(15_000).fromId, 'fly-by');
});

test('camera move eases between shots and loops without a discontinuity', () => {
  const moving = aircraftShotFrame(3_100);
  assert.equal(moving.fromId, 'fly-by');
  assert.equal(moving.toId, 'full-45');
  assert.ok(moving.mix > 0 && moving.mix < 1);
  assert.notDeepEqual(moving.cameraPosition, aircraftShotFrame(0).cameraPosition);
  assert.deepEqual(aircraftShotFrame(30_000), aircraftShotFrame(0));
});

test('flight motion keeps the aircraft visibly flying without automatic spinning', () => {
  const start = aircraftFlightMotion(0, { verticalRateFpm: 0 });
  const later = aircraftFlightMotion(1_000, { verticalRateFpm: 0 });
  assert.notDeepEqual(later, start);
  assert.ok(aircraftFlightMotion(5_000).forward < start.forward, 'the aircraft advances along its nose instead of hovering');
  assert.ok(aircraftFlightMotion(10_000).forward < aircraftFlightMotion(5_000).forward, 'forward travel remains one-way throughout the shot cycle');
  for (let time = 0; time <= 15_000; time += 250) {
    const motion = aircraftFlightMotion(time, { verticalRateFpm: 2_000 });
    assert.ok(Math.abs(motion.lift) <= .09);
    assert.ok(Math.abs(motion.sway) <= .07);
    assert.ok(Math.abs(motion.surge) <= .1);
    assert.ok(Math.abs(motion.roll) <= .08);
    assert.ok(Math.abs(motion.pitch) <= .06);
    assert.ok(Math.abs(motion.forward) <= 1.8);
  }
});

test('manual camera control holds for six seconds then eases back to the director', () => {
  assert.deepEqual(aircraftControlPhase({ now: 5_000, manualUntil: 6_000, resumeStart: null }), { mode: 'manual', progress: 0 });
  const resuming = aircraftControlPhase({ now: 6_700, manualUntil: 6_000, resumeStart: 6_000 });
  assert.equal(resuming.mode, 'resume');
  assert.equal(resuming.progress, .5);
  assert.deepEqual(aircraftControlPhase({ now: 7_500, manualUntil: 6_000, resumeStart: 6_000 }), { mode: 'auto', progress: 1 });
});

test('reduced motion keeps the complete-airframe shot stable while flight motion remains subtle', () => {
  assert.deepEqual(aircraftShotFrame(0, { reducedMotion: true }), aircraftShotFrame(8_000, { reducedMotion: true }));
  assert.equal(aircraftShotFrame(0, { reducedMotion: true }).fromId, 'full-45');
});

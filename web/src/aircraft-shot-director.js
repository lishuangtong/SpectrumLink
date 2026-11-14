export const AIRCRAFT_SHOT_CYCLE_MS = 15_000;
export const AIRCRAFT_MANUAL_HOLD_MS = 6_000;
export const AIRCRAFT_RESUME_MS = 1_400;

const SEGMENT_MS = AIRCRAFT_SHOT_CYCLE_MS / 4;
const HOLD_MS = 2_500;

const SHOTS = Object.freeze([
  Object.freeze({
    id: 'fly-by',
    cameraPosition: Object.freeze([4.8, 2.2, -9.2]),
    target: Object.freeze([0, 0, -.7]),
    stageOffset: Object.freeze([-.6, .1, -.1]),
    stageOffsetFrom: Object.freeze([2.2, .05, .15]),
    fov: 38,
    pitch: .08,
    yaw: 0,
  }),
  Object.freeze({
    id: 'full-45',
    cameraPosition: Object.freeze([10.4, 5.8, 12.2]),
    target: Object.freeze([0, -.15, 0]),
    stageOffset: Object.freeze([0, 0, 0]),
    fov: 40,
    pitch: .06,
    yaw: 0,
  }),
  Object.freeze({
    id: 'engine-detail',
    cameraPosition: Object.freeze([4.2, 1.15, 3.6]),
    target: Object.freeze([1.6, -.2, -.25]),
    stageOffset: Object.freeze([0, 0, 0]),
    fov: 25,
    pitch: .18,
    yaw: -.55,
  }),
  Object.freeze({
    id: 'overhead',
    cameraPosition: Object.freeze([.8, 13.8, 7.5]),
    target: Object.freeze([0, 0, 0]),
    stageOffset: Object.freeze([0, 0, 0]),
    fov: 38,
    pitch: 0,
    yaw: 0,
  }),
]);

const clamp01 = (value) => Math.max(0, Math.min(1, value));
const smoothstep = (value) => {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
};
const lerp = (from, to, progress) => from + (to - from) * progress;
const lerpVector = (from, to, progress) => from.map((value, index) => lerp(value, to[index], progress));
const cloneShot = (shot) => ({
  fromId: shot.id,
  toId: shot.id,
  mix: 0,
  cameraPosition: [...shot.cameraPosition],
  target: [...shot.target],
  stageOffset: [...shot.stageOffset],
  fov: shot.fov,
  pitch: shot.pitch,
  yaw: shot.yaw,
});

export function interpolateAircraftFrame(from, to, progress) {
  const mix = smoothstep(progress);
  return {
    fromId: from.fromId,
    toId: to.fromId,
    mix,
    cameraPosition: lerpVector(from.cameraPosition, to.cameraPosition, mix),
    target: lerpVector(from.target, to.target, mix),
    stageOffset: lerpVector(from.stageOffset, to.stageOffset, mix),
    fov: lerp(from.fov, to.fov, mix),
    pitch: lerp(from.pitch, to.pitch, mix),
    yaw: lerp(from.yaw, to.yaw, mix),
  };
}

export function aircraftShotFrame(elapsedMs, { reducedMotion = false } = {}) {
  if (reducedMotion) return cloneShot(SHOTS[1]);
  const elapsed = ((Number(elapsedMs) || 0) % AIRCRAFT_SHOT_CYCLE_MS + AIRCRAFT_SHOT_CYCLE_MS) % AIRCRAFT_SHOT_CYCLE_MS;
  const index = Math.min(SHOTS.length - 1, Math.floor(elapsed / SEGMENT_MS));
  const local = elapsed - index * SEGMENT_MS;
  const current = cloneShot(SHOTS[index]);
  if (index === 0 && local <= HOLD_MS) {
    current.stageOffset = lerpVector(SHOTS[0].stageOffsetFrom, SHOTS[0].stageOffset, smoothstep(local / HOLD_MS));
  }
  if (local <= HOLD_MS) return current;
  const next = cloneShot(SHOTS[(index + 1) % SHOTS.length]);
  return interpolateAircraftFrame(current, next, (local - HOLD_MS) / (SEGMENT_MS - HOLD_MS));
}

export function aircraftFlightMotion(timeMs, telemetry = {}) {
  const seconds = (Number(timeMs) || 0) / 1_000;
  const cycleProgress = ((seconds % 15) + 15) % 15 / 15;
  const verticalRate = Math.max(-4_000, Math.min(4_000, Number(telemetry.verticalRateFpm) || 0));
  return {
    forward: 1.6 - cycleProgress * 3.2,
    lift: Math.sin(seconds * 1.35) * .08,
    sway: Math.sin(seconds * .62 + .8) * .06,
    surge: Math.sin(seconds * .44) * .09,
    roll: Math.sin(seconds * .52) * .035 + verticalRate / 400_000,
    pitch: Math.sin(seconds * .73) * .012 + verticalRate / 500_000,
  };
}

export function aircraftControlPhase({ now, manualUntil, resumeStart }) {
  if (now < manualUntil) return { mode: 'manual', progress: 0 };
  if (resumeStart != null && now < resumeStart + AIRCRAFT_RESUME_MS) {
    return { mode: 'resume', progress: clamp01((now - resumeStart) / AIRCRAFT_RESUME_MS) };
  }
  return { mode: 'auto', progress: 1 };
}

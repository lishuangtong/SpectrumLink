const finite = (value) => value !== null && value !== '' && Number.isFinite(Number(value)) ? Number(value) : null;

export const AIRCRAFT_CAROUSEL_INTERVAL_MS = 15_000;
export const AIRCRAFT_TRANSITION_MS = 700;

export function createAircraftTransitionController({
  stage,
  duration = AIRCRAFT_TRANSITION_MS,
  setTimeoutFn = globalThis.setTimeout.bind(globalThis),
  clearTimeoutFn = globalThis.clearTimeout.bind(globalThis),
}) {
  let timer = null;
  let version = 0;
  const outDuration = Math.round(duration * .4);
  const inDuration = duration - outDuration;

  const transition = (update) => {
    version += 1;
    const currentVersion = version;
    if (timer !== null) clearTimeoutFn(timer);
    stage.classList.remove('is-switching-in');
    stage.classList.add('is-switching-out');
    timer = setTimeoutFn(() => {
      if (currentVersion !== version) return;
      update();
      stage.classList.remove('is-switching-out');
      stage.classList.add('is-switching-in');
      timer = setTimeoutFn(() => {
        if (currentVersion !== version) return;
        stage.classList.remove('is-switching-in');
        timer = null;
      }, inDuration);
    }, outDuration);
  };

  return {
    transition,
    destroy() {
      version += 1;
      if (timer !== null) clearTimeoutFn(timer);
      timer = null;
      stage.classList.remove('is-switching-out');
      stage.classList.remove('is-switching-in');
    },
  };
}

const MODEL_PROFILES = {
  A318: ['a320', 'Airbus A318'], A319: ['a320', 'Airbus A319'], A19N: ['a320', 'Airbus A319neo'], A320: ['a320', 'Airbus A320'], A20N: ['a320', 'Airbus A320neo'], A321: ['a320', 'Airbus A321'], A21N: ['a320', 'Airbus A321neo'],
  B736: ['b737', 'Boeing 737-600'], B737: ['b737', 'Boeing 737-700'], B738: ['b737', 'Boeing 737-800'], B739: ['b737', 'Boeing 737-900'], B38M: ['b737', 'Boeing 737 MAX 8'], B39M: ['b737', 'Boeing 737 MAX 9'],
  AJ27: ['arj21', 'COMAC ARJ21-700'], C919: ['c919', 'COMAC C919'],
  B788: ['b787', 'Boeing 787-8'], B789: ['b787', 'Boeing 787-9'], B78X: ['b787', 'Boeing 787-10'],
  B744: ['b777', 'Boeing 747-400'], B748: ['b777', 'Boeing 747-8'], B752: ['b777', 'Boeing 757-200'], B753: ['b777', 'Boeing 757-300'],
  B762: ['b777', 'Boeing 767-200'], B763: ['b777', 'Boeing 767-300'], B764: ['b777', 'Boeing 767-400'],
  B772: ['b777', 'Boeing 777-200'], B77L: ['b777', 'Boeing 777-200LR/F'], B77W: ['b777', 'Boeing 777-300ER'], B773: ['b777', 'Boeing 777-300'],
  A332: ['a330', 'Airbus A330-200'], A333: ['a330', 'Airbus A330-300'], A338: ['a330', 'Airbus A330-800neo'], A339: ['a330', 'Airbus A330-900neo'], A343: ['a330', 'Airbus A340-300'], A346: ['a330', 'Airbus A340-600'],
  A359: ['a350', 'Airbus A350-900'], A35K: ['a350', 'Airbus A350-1000'], A380: ['a350', 'Airbus A380-800'],
  E170: ['regional', 'Embraer E170'], E75L: ['regional', 'Embraer E175'], E75S: ['regional', 'Embraer E175'], E190: ['regional', 'Embraer E190'], E195: ['regional', 'Embraer E195'],
  CRJ2: ['regional', 'Bombardier CRJ200'], CRJ7: ['regional', 'Bombardier CRJ700'], CRJ9: ['regional', 'Bombardier CRJ900'], CRJX: ['regional', 'Bombardier CRJ1000'],
  AT72: ['turboprop', 'ATR 72-200'], AT75: ['turboprop', 'ATR 72-500'], AT76: ['turboprop', 'ATR 72-600'], DH8D: ['turboprop', 'De Havilland Dash 8-400'],
};
const MODEL_DIMENSIONS = {
  A319: [.92, .96], A19N: [.92, .96], A320: [1, 1], A20N: [1, 1], A321: [1.08, .96], A21N: [1.08, .96],
  B737: [.92, .96], B738: [1, 1], B739: [1.07, 1], B38M: [1.02, 1.04], B39M: [1.08, 1.04],
  AJ27: [.9, .82], C919: [1.04, 1.02], B788: [.96, .98], B789: [1.04, 1], B78X: [1.1, 1],
  B772: [.96, 1], B77L: [1, 1], B77W: [1.1, 1], B773: [1.08, 1],
  A332: [.96, 1], A333: [1.04, 1], A338: [.98, 1], A339: [1.06, 1], A359: [1, 1], A35K: [1.09, 1],
  E170: [.88, .82], E75L: [.92, .84], E75S: [.92, .84], E190: [.98, .88], E195: [1.04, .88],
  CRJ2: [.86, .7], CRJ7: [.94, .74], CRJ9: [1, .76], CRJX: [1.05, .78],
  AT72: [.84, .92], AT75: [.85, .92], AT76: [.86, .92], DH8D: [.92, 1],
};

export function aircraftModelProfile(type) {
  const code = String(type || '').trim().toUpperCase();
  const [family, name] = MODEL_PROFILES[code] || ['generic', code || '机型待识别'];
  const [length, span] = MODEL_DIMENSIONS[code] || [1, 1];
  return { family, name, length, span };
}

export function nextAircraftId(aircraft, selectedId) {
  if (!aircraft.length) return null;
  const index = aircraft.findIndex((plane) => plane.id === selectedId);
  return aircraft[(index + 1 + aircraft.length) % aircraft.length].id;
}

export function shouldAdvanceAircraftCarousel({ hidden, pausedUntil, now, count, modalOpen, modelLoading }) {
  return !hidden && !modalOpen && !modelLoading && count >= 2 && now >= pausedUntil;
}

export function essentialAircraftFacts(plane) {
  const facts = [];
  const add = (label, value) => { if (value !== null && value !== undefined && value !== '') facts.push([label, String(value)]); };
  add('ICAO', plane.id);
  add('注册号', plane.registration);
  add('机型', plane.type);
  const altitude = finite(plane.altitudeFt); if (altitude !== null) add('高度', `${Math.round(altitude).toLocaleString('en-US')} ft`);
  const speed = finite(plane.speedKt); if (speed !== null) add('地速', `${Math.round(speed)} kt`);
  const heading = finite(plane.headingDeg); if (heading !== null) add('航向', `${Math.round(heading)}°`);
  const distance = finite(plane.distanceKm); const bearing = finite(plane.bearingDeg);
  if (distance !== null && bearing !== null) add('距离 / 方位', `${Math.round(distance)} km · ${Math.round(bearing)}°`);
  return facts;
}

export function aircraftPose(plane) {
  const heading = finite(plane.headingDeg) ?? 0;
  const verticalRate = finite(plane.verticalRateFpm) ?? 0;
  const direction = Math.sign(verticalRate);
  return {
    yaw: ((heading % 360) + 360) % 360,
    pitch: Math.max(-8, Math.min(8, -verticalRate / 300)),
    bank: direction * 12,
  };
}

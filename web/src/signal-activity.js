const finiteBins = (bins) => Array.from(bins || [], Number).filter(Number.isFinite);

export function estimateNoiseFloor(bins) {
  const values = finiteBins(bins).sort((a, b) => a - b);
  if (!values.length) return -121;
  return values[Math.floor((values.length - 1) * .35)];
}

function frequencyAt(sweep, bin) {
  return sweep.centerHz + (bin - 32) * sweep.stepHz;
}

export function findTopPeaks(sweep, { thresholdDb = 12, limit = 3, minSeparationBins = 4 } = {}) {
  if (!sweep?.bins?.length) return [];
  const noiseFloor = estimateNoiseFloor(sweep.bins);
  const values = finiteBins(sweep.bins);
  const sweepSpreadDb = values.length ? Math.max(...values) - Math.min(...values) : 0;
  const candidates = [];
  for (let bin = 0; bin < sweep.bins.length; bin += 1) {
    const value = Number(sweep.bins[bin]);
    const aboveNoiseDb = value - noiseFloor;
    const standardCandidate = aboveNoiseDb >= thresholdDb;
    const guardedS9Candidate = value >= -93 && (aboveNoiseDb >= 4 || (bin === sweep.peakIndex && sweepSpreadDb >= 1));
    if (!standardCandidate && !guardedS9Candidate) continue;
    const left = bin ? Number(sweep.bins[bin - 1]) : -Infinity;
    const right = bin + 1 < sweep.bins.length ? Number(sweep.bins[bin + 1]) : -Infinity;
    if (value >= left && value >= right) candidates.push({ bin, dbm: value, strongSignal: guardedS9Candidate });
  }
  const selected = [];
  for (const candidate of candidates.sort((a, b) => b.dbm - a.dbm || a.bin - b.bin)) {
    if (selected.some((peak) => Math.abs(peak.bin - candidate.bin) < minSeparationBins)) continue;
    selected.push({ ...candidate, frequencyHz: frequencyAt(sweep, candidate.bin), aboveNoiseDb: candidate.dbm - noiseFloor });
    if (selected.length >= limit) break;
  }
  return selected;
}

export function createSignalActivityDetector({ thresholdDb = 12, releaseMs = 500, requiredSweeps = 2 } = {}) {
  let candidateCount = 0;
  let active = false;
  let startedAt = null;
  let lastSignalAt = null;
  let frequencyHz = null;
  let peakDbm = -121;
  let noiseFloor = -121;

  return {
    update(sweep, now = Date.now()) {
      const peaks = findTopPeaks(sweep, { thresholdDb, limit: 3 });
      const strongest = peaks[0] ?? null;
      noiseFloor = estimateNoiseFloor(sweep?.bins);
      let completedEvent = null;

      if (strongest) {
        candidateCount += 1;
        lastSignalAt = now;
        const activationSweeps = strongest.strongSignal ? 1 : requiredSweeps;
        if (!active && candidateCount >= activationSweeps) {
          active = true;
          startedAt = now;
          frequencyHz = strongest.frequencyHz;
          peakDbm = strongest.dbm;
        } else if (active && strongest.dbm > peakDbm) {
          frequencyHz = strongest.frequencyHz;
          peakDbm = strongest.dbm;
        }
      } else {
        candidateCount = 0;
        if (active && now - lastSignalAt > releaseMs) {
          completedEvent = {
            startedAt,
            endedAt: now,
            durationMs: now - startedAt,
            frequencyHz,
            peakDbm,
            noiseFloor,
          };
          active = false;
          startedAt = null;
          lastSignalAt = null;
          frequencyHz = null;
          peakDbm = -121;
        }
      }

      return {
        active,
        startedAt,
        durationMs: active ? now - startedAt : 0,
        frequencyHz,
        peakDbm,
        noiseFloor,
        peaks,
        completedEvent,
      };
    },
  };
}


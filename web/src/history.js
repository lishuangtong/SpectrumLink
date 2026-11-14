export const MAX_HISTORY_DEPTH = 256;

export function normalizeDbm(value, floor = -120, ceiling = -40) {
  if (ceiling <= floor) throw new RangeError('ceiling must be greater than floor');
  return Math.max(0, Math.min(1, (value - floor) / (ceiling - floor)));
}

function validDepth(depth) {
  if (!Number.isInteger(depth) || depth < 1 || depth > MAX_HISTORY_DEPTH) {
    throw new RangeError(`history depth must be between 1 and ${MAX_HISTORY_DEPTH}`);
  }
}

function makeRow() {
  return { sequence: 0, centerHz: 0, stepHz: 0, peakIndex: 0, flags: 0, receivedAt: 0, bins: new Int8Array(64) };
}

export class SpectrumHistory {
  constructor({ depth = 96 } = {}) {
    validDepth(depth);
    this.depth = depth;
    this.#storage = Array.from({ length: depth }, makeRow);
    this.peakHold = new Int8Array(64);
    this.peakHold.fill(-128);
  }

  diagnostics = { sequenceGaps: 0 };
  #storage;
  #head = 0;
  #count = 0;
  #geometry;
  #lastSequence;

  get rows() {
    const rows = [];
    const start = (this.#head - this.#count + this.depth) % this.depth;
    for (let index = 0; index < this.#count; index += 1) {
      rows.push(this.#storage[(start + index) % this.depth]);
    }
    return rows;
  }

  get latest() {
    if (this.#count === 0) return null;
    return this.#storage[(this.#head - 1 + this.depth) % this.depth];
  }

  clear() {
    this.#head = 0;
    this.#count = 0;
    this.#geometry = undefined;
    this.#lastSequence = undefined;
    this.peakHold.fill(-128);
  }

  setDepth(depth) {
    validDepth(depth);
    if (depth === this.depth) return;
    const retained = this.rows.slice(-depth).map((row) => ({ ...row, bins: row.bins.slice() }));
    this.depth = depth;
    this.#storage = Array.from({ length: depth }, makeRow);
    this.#count = retained.length;
    this.#head = retained.length % depth;
    retained.forEach((source, index) => {
      const target = this.#storage[index];
      target.sequence = source.sequence;
      target.centerHz = source.centerHz;
      target.stepHz = source.stepHz;
      target.peakIndex = source.peakIndex;
      target.flags = source.flags;
      target.receivedAt = source.receivedAt;
      target.bins.set(source.bins);
    });
  }

  append(sweep) {
    if (!sweep?.bins || sweep.bins.length !== 64) throw new RangeError('sweep must contain exactly 64 bins');
    if (!Number.isFinite(sweep.centerHz) || !Number.isFinite(sweep.stepHz) || sweep.stepHz <= 0) {
      throw new RangeError('invalid sweep geometry');
    }
    const geometry = `${sweep.centerHz}:${sweep.stepHz}`;
    if (this.#geometry !== undefined && this.#geometry !== geometry) this.clear();
    this.#geometry = geometry;

    if (this.#lastSequence !== undefined && sweep.sequence !== ((this.#lastSequence + 1) & 0xffff)) {
      this.diagnostics.sequenceGaps += 1;
    }
    this.#lastSequence = sweep.sequence;

    const row = this.#storage[this.#head];
    row.sequence = sweep.sequence;
    row.centerHz = sweep.centerHz;
    row.stepHz = sweep.stepHz;
    row.peakIndex = sweep.peakIndex;
    row.flags = sweep.flags;
    row.receivedAt = Number.isFinite(sweep.receivedAt) ? sweep.receivedAt : Date.now();
    for (let index = 0; index < 64; index += 1) {
      const value = Math.max(-128, Math.min(0, Math.round(sweep.bins[index])));
      row.bins[index] = value;
      this.peakHold[index] = Math.max(value, this.peakHold[index] - 1);
    }
    this.#head = (this.#head + 1) % this.depth;
    this.#count = Math.min(this.#count + 1, this.depth);
    return row;
  }
}


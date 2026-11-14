const SPANS = new Set([400_000, 800_000, 1_600_000, 3_200_000]);

export class SweepSimulator {
  constructor({
    setIntervalFn = globalThis.setInterval.bind(globalThis),
    clearIntervalFn = globalThis.clearInterval.bind(globalThis),
    intervalMs = 100,
  } = {}) {
    this.setIntervalFn = setIntervalFn;
    this.clearIntervalFn = clearIntervalFn;
    this.intervalMs = intervalMs;
  }

  #centerHz = 145_500_000;
  #spanHz = 400_000;
  #sequence = 0;
  #timer;
  #onSweep;

  setCenter(centerHz) {
    if (!Number.isInteger(centerHz) || centerHz <= 0) throw new RangeError('invalid center frequency');
    this.#centerHz = centerHz;
  }

  setSpan(spanHz) {
    if (!SPANS.has(spanHz)) throw new RangeError('unsupported span');
    this.#spanHz = spanHz;
  }

  start(onSweep) {
    if (this.#timer) return;
    this.#onSweep = onSweep;
    this.#emit();
    this.#timer = this.setIntervalFn(() => this.#emit(), this.intervalMs);
  }

  stop() {
    if (!this.#timer) return;
    this.clearIntervalFn(this.#timer);
    this.#timer = undefined;
  }

  #emit() {
    const sequence = this.#sequence++;
    const bins = new Int8Array(64);
    const carriers = [
      [8, 31, .65], [14, 43, .8], [20, 57, .6], [27, 37, 1.05],
      [32, 70, .72], [39, 46, .9], [47, 61, .75], [54, 50, .82], [59, 35, .58],
    ];
    const transmitting = sequence % 80 < 65;
    let peakIndex = 0;
    for (let index = 0; index < bins.length; index += 1) {
      const noise = -116 + Math.round(2.5 * Math.sin(index * 1.91 + sequence * 0.37));
      const channelEnergy = transmitting ? Math.max(...carriers.map(([center, amplitude, width]) => (
        amplitude * Math.exp(-0.5 * ((index - center) / width) ** 2)
      ))) : 0;
      const wide = transmitting ? 27 * Math.exp(-0.5 * ((index - 44) / 7.5) ** 2) : 0;
      bins[index] = Math.max(-128, Math.min(0, Math.round(noise + channelEnergy + wide)));
      if (bins[index] > bins[peakIndex]) peakIndex = index;
    }
    this.#onSweep({
      sequence,
      centerHz: this.#centerHz,
      stepHz: this.#spanHz / 64,
      peakIndex,
      flags: 0x01,
      bins,
    });
  }
}


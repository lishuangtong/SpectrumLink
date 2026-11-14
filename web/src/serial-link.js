import { decodeHello, encodeFrame, FrameParser, MESSAGE } from './protocol.js';

export class SerialLink {
  constructor({
    serialProvider = globalThis.navigator?.serial,
    setIntervalFn = globalThis.setInterval.bind(globalThis),
    clearIntervalFn = globalThis.clearInterval.bind(globalThis),
  } = {}) {
    this.serialProvider = serialProvider;
    this.setIntervalFn = setIntervalFn;
    this.clearIntervalFn = clearIntervalFn;
  }

  state = 'disconnected';
  onFrame = () => {};
  onState = () => {};
  onError = () => {};

  #port;
  #reader;
  #writer;
  #parser = new FrameParser();
  #writeChain = Promise.resolve();
  #sequence = 0;
  #heartbeat;
  #disconnecting = false;
  #closing;

  #setState(state) {
    if (this.state === state) return;
    this.state = state;
    this.onState(state);
  }

  async connect() {
    if (this.state !== 'disconnected') throw new Error('serial link is already active');
    if (!this.serialProvider?.requestPort) throw new Error('Web Serial is not available');
    this.#disconnecting = false;
    this.#setState('selecting');
    try {
      this.#port = await this.serialProvider.requestPort();
      await this.#port.open({ baudRate: 115200 });
      this.#writer = this.#port.writable.getWriter();
      this.#reader = this.#port.readable.getReader();
      this.#setState('connecting');
      void this.#readLoop();
    } catch (error) {
      this.#setState('disconnected');
      this.onError(error);
      throw error;
    }
  }

  async #readLoop() {
    let readError;
    try {
      while (!this.#disconnecting) {
        const { value, done } = await this.#reader.read();
        if (done) break;
        if (!value) continue;
        for (const frame of this.#parser.push(value)) {
          if (frame.type === MESSAGE.HELLO && this.state === 'connecting') {
            try {
              decodeHello(frame);
              this.#setState('ready');
              this.#startHeartbeat();
            } catch (error) {
              this.onError(error);
              continue;
            }
          }
          this.onFrame(frame);
        }
      }
    } catch (error) {
      readError = error;
    }
    if (!this.#disconnecting) {
      if (readError) this.onError(readError);
      await this.#closeResources(false);
    }
  }

  #startHeartbeat() {
    if (this.#heartbeat) return;
    this.#heartbeat = this.setIntervalFn(() => {
      void this.send(MESSAGE.PING).catch((error) => this.onError(error));
    }, 500);
  }

  send(type, payload = new Uint8Array()) {
    if (!this.#writer) return Promise.reject(new Error('serial link is not open'));
    const frame = encodeFrame(type, this.#sequence, payload);
    this.#sequence = (this.#sequence + 1) & 0xffff;
    const write = this.#writeChain.then(() => this.#writer.write(frame));
    this.#writeChain = write.catch(() => {});
    return write;
  }

  async disconnect() {
    if (this.state === 'disconnected') return;
    this.#disconnecting = true;
    await this.#closeResources(true);
    this.#disconnecting = false;
  }

  async #closeResources(cancelReader) {
    if (this.#closing) return this.#closing;
    this.#closing = (async () => {
    if (this.#heartbeat) {
      this.clearIntervalFn(this.#heartbeat);
      this.#heartbeat = undefined;
    }
    if (cancelReader) {
      try { await this.#reader?.cancel(); } catch {}
    }
    this.#reader?.releaseLock();
    this.#reader = undefined;
    try {
      await this.#writeChain;
    } catch {}
    this.#writer?.releaseLock();
    this.#writer = undefined;
    try {
      await this.#port?.close();
    } finally {
      this.#port = undefined;
      this.#parser = new FrameParser();
      this.#setState('disconnected');
    }
    })();
    try { await this.#closing; } finally { this.#closing = undefined; }
  }

  get parserStats() {
    return { ...this.#parser.stats };
  }
}


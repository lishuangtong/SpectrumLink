import assert from 'node:assert/strict';
import test from 'node:test';

import { encodeFrame, MESSAGE } from '../../web/src/protocol.js';
import { SerialLink } from '../../web/src/serial-link.js';
import { SweepSimulator } from '../../web/src/simulator.js';

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const helloFrame = () => encodeFrame(MESSAGE.HELLO, 1, Uint8Array.of(1, 3, 64, 15, 0, 1));

function fakeSerial() {
  let input;
  const writes = [];
  const port = {
    openedWith: null,
    closeCount: 0,
    readable: new ReadableStream({ start(controller) { input = controller; } }),
    writable: new WritableStream({ write(chunk) { writes.push(new Uint8Array(chunk)); } }),
    async open(options) { this.openedWith = options; },
    async close() { this.closeCount += 1; },
  };
  const provider = {
    requests: 0,
    async requestPort() { this.requests += 1; return port; },
  };
  return { provider, port, writes, input };
}

function fakeIntervals() {
  const callbacks = new Map();
  let next = 1;
  return {
    callbacks,
    set(fn, delay) { const id = next++; callbacks.set(id, { fn, delay }); return id; },
    clear(id) { callbacks.delete(id); },
    tick() { for (const { fn } of callbacks.values()) fn(); },
  };
}

test('SerialLink requests a port but stays connecting until fragmented HELLO arrives', async () => {
  const serial = fakeSerial();
  const timers = fakeIntervals();
  const states = [];
  const frames = [];
  const link = new SerialLink({
    serialProvider: serial.provider,
    setIntervalFn: timers.set.bind(timers),
    clearIntervalFn: timers.clear.bind(timers),
  });
  link.onState = (state) => states.push(state);
  link.onFrame = (frame) => frames.push(frame);

  await link.connect();
  assert.equal(serial.provider.requests, 1);
  assert.deepEqual(serial.port.openedWith, { baudRate: 115200 });
  assert.equal(link.state, 'connecting');

  const hello = helloFrame();
  serial.input.enqueue(hello.slice(0, 5));
  serial.input.enqueue(hello.slice(5));
  await settle();

  assert.equal(link.state, 'ready');
  assert.equal(frames.length, 1);
  assert.deepEqual(states, ['selecting', 'connecting', 'ready']);
  await link.disconnect();
});

test('SerialLink sends heartbeat frames every 500 ms after HELLO', async () => {
  const serial = fakeSerial();
  const timers = fakeIntervals();
  const link = new SerialLink({
    serialProvider: serial.provider,
    setIntervalFn: timers.set.bind(timers),
    clearIntervalFn: timers.clear.bind(timers),
  });
  await link.connect();
  serial.input.enqueue(helloFrame());
  await settle();

  assert.deepEqual([...timers.callbacks.values()].map((item) => item.delay), [500]);
  timers.tick();
  await settle();
  assert.equal(serial.writes.length, 1);
  assert.equal(serial.writes[0][5], MESSAGE.PING);
  await link.disconnect();
});

test('SerialLink serializes writes and explicit disconnect releases the port', async () => {
  const serial = fakeSerial();
  const timers = fakeIntervals();
  const link = new SerialLink({
    serialProvider: serial.provider,
    setIntervalFn: timers.set.bind(timers),
    clearIntervalFn: timers.clear.bind(timers),
  });
  await link.connect();
  serial.input.enqueue(helloFrame());
  await settle();
  await Promise.all([
    link.send(MESSAGE.PAUSE),
    link.send(MESSAGE.RESUME),
  ]);
  await link.disconnect();

  assert.deepEqual(serial.writes.slice(-2).map((frame) => frame[5]), [MESSAGE.PAUSE, MESSAGE.RESUME]);
  assert.equal(serial.port.closeCount, 1);
  assert.equal(link.state, 'disconnected');
  assert.equal(timers.callbacks.size, 0);
  assert.equal(serial.provider.requests, 1, 'explicit disconnect must not reconnect');
});

test('SerialLink releases the port after a read failure and becomes reconnectable', async () => {
  const serial = fakeSerial();
  const timers = fakeIntervals();
  const errors = [];
  const link = new SerialLink({
    serialProvider: serial.provider,
    setIntervalFn: timers.set.bind(timers),
    clearIntervalFn: timers.clear.bind(timers),
  });
  link.onError = (error) => errors.push(error.message);
  await link.connect();
  serial.input.error(new Error('cable lost'));
  await settle();

  assert.equal(link.state, 'disconnected');
  assert.deepEqual(errors, ['cable lost']);
  assert.equal(serial.provider.requests, 1);
  assert.equal(serial.port.closeCount, 1);
  assert.equal(timers.callbacks.size, 0);
});

test('SerialLink treats stream EOF as disconnect and releases resources', async () => {
  const serial = fakeSerial();
  const timers = fakeIntervals();
  const link = new SerialLink({
    serialProvider: serial.provider,
    setIntervalFn: timers.set.bind(timers),
    clearIntervalFn: timers.clear.bind(timers),
  });
  await link.connect();
  serial.input.enqueue(helloFrame());
  await settle();
  serial.input.close();
  await settle();
  assert.equal(link.state, 'disconnected');
  assert.equal(serial.port.closeCount, 1);
  assert.equal(timers.callbacks.size, 0);
});

test('SerialLink refuses a truncated HELLO and keeps controls unready', async () => {
  const serial = fakeSerial();
  const timers = fakeIntervals();
  const errors = [];
  const link = new SerialLink({
    serialProvider: serial.provider,
    setIntervalFn: timers.set.bind(timers),
    clearIntervalFn: timers.clear.bind(timers),
  });
  link.onError = (error) => errors.push(error.message);
  await link.connect();
  serial.input.enqueue(encodeFrame(MESSAGE.HELLO, 1));
  await settle();
  assert.equal(link.state, 'connecting');
  assert.match(errors[0], /HELLO length/i);
  assert.equal(timers.callbacks.size, 0);
  await link.disconnect();
});

test('SweepSimulator emits deterministic legal 64-bin sweeps', () => {
  const callbacks = [];
  let timerCallback;
  const simulator = new SweepSimulator({
    setIntervalFn(fn) { timerCallback = fn; return 1; },
    clearIntervalFn() {},
  });
  simulator.setCenter(145_500_000);
  simulator.setSpan(800_000);
  simulator.start((sweep) => callbacks.push(sweep));
  timerCallback();
  timerCallback();
  simulator.stop();

  assert.deepEqual(callbacks.map((sweep) => sweep.sequence), [0, 1, 2]);
  for (const sweep of callbacks) {
    assert.equal(sweep.centerHz, 145_500_000);
    assert.equal(sweep.stepHz, 12_500);
    assert.equal(sweep.bins.length, 64);
    assert.ok([...sweep.bins].every((value) => value >= -128 && value <= 0));
    assert.ok([...sweep.bins].filter((value) => value > -90).length >= 8, 'demo waterfall should contain several persistent carrier stripes');
  }
  assert.ok(new Set(callbacks.map((sweep) => sweep.peakIndex)).size <= 2, 'demo carriers stay at fixed frequencies instead of drawing diagonal sweeps');
});

test('SweepSimulator includes a quiet interval so RF events can complete in demo mode', () => {
  const sweeps = [];
  let timerCallback;
  const simulator = new SweepSimulator({
    setIntervalFn(fn) { timerCallback = fn; return 1; },
    clearIntervalFn() {},
  });
  simulator.start((sweep) => sweeps.push(sweep));
  for (let index = 0; index < 65; index += 1) timerCallback();
  simulator.stop();
  assert.ok(Math.max(...sweeps[0].bins) > -90);
  assert.ok(Math.max(...sweeps.at(-1).bins) < -108);
});


import assert from 'node:assert/strict';
import test from 'node:test';

import {
  FrameParser,
  MAX_PAYLOAD,
  MESSAGE,
  PROTOCOL_VERSION,
  decodeHello,
  decodeStatus,
  decodeSweep,
  encodeFrame,
} from '../../web/src/protocol.js';

test('HELLO decoder rejects truncated and incompatible radios', () => {
  const frame = (payload) => ({ type: MESSAGE.HELLO, sequence: 1, payload });
  assert.throws(() => decodeHello(frame(new Uint8Array())), /HELLO length/i);
  assert.throws(() => decodeHello(frame(Uint8Array.of(2, 3, 64, 15, 0, 1))), /ABI/i);
  assert.throws(() => decodeHello(frame(Uint8Array.of(1, 2, 64, 15, 0, 1))), /API/i);
  assert.throws(() => decodeHello(frame(Uint8Array.of(1, 3, 32, 15, 0, 1))), /64 bins/i);
  assert.deepEqual(decodeHello(frame(Uint8Array.of(1, 3, 64, 15, 0, 1))), {
    abi: 1, api: 3, bins: 64, spanMask: 15, appVersion: '0.1',
  });
});

test('STATUS decoder exposes mode and radio-side error counters', () => {
  const payload = Uint8Array.of(3, 5, 7, 0, 2, 0, 1, 0);
  assert.deepEqual(decodeStatus({ type: MESSAGE.STATUS, payload }), {
    mode: 3, flags: 5, droppedFrames: 7, crcErrors: 2, lengthErrors: 1,
  });
});

function sweepPayload({ bins = 64, peakIndex = 11 } = {}) {
  const payload = new Uint8Array(10 + bins);
  const view = new DataView(payload.buffer);
  view.setUint32(0, 14_550_000, true);
  view.setUint16(4, 625, true);
  payload[6] = bins;
  payload[7] = peakIndex;
  payload[8] = 0x05;
  payload[9] = 0;
  for (let index = 0; index < bins; index += 1) {
    view.setInt8(10 + index, -120 + index);
  }
  return payload;
}

test('frame encoding writes the versioned little-endian header', () => {
  const frame = encodeFrame(MESSAGE.STATUS, 0x1234, Uint8Array.of(0xaa, 0xbb));
  assert.deepEqual([...frame.slice(0, 10)], [
    0x53, 0x4c, 0x4e, 0x4b,
    PROTOCOL_VERSION,
    MESSAGE.STATUS,
    0x02, 0x00,
    0x34, 0x12,
  ]);
  assert.deepEqual([...frame.slice(10, 12)], [0xaa, 0xbb]);
});

test('frame encoding rejects payloads beyond the wire limit', () => {
  assert.throws(
    () => encodeFrame(MESSAGE.STATUS, 0, new Uint8Array(MAX_PAYLOAD + 1)),
    /payload/i,
  );
});

test('parser and decoder expose a valid 64-bin sweep', () => {
  const parser = new FrameParser();
  const frames = parser.push(encodeFrame(MESSAGE.SWEEP, 9, sweepPayload()));
  assert.equal(frames.length, 1);

  const sweep = decodeSweep(frames[0]);
  assert.equal(sweep.sequence, 9);
  assert.equal(sweep.centerHz, 145_500_000);
  assert.equal(sweep.stepHz, 6_250);
  assert.equal(sweep.peakIndex, 11);
  assert.equal(sweep.flags, 0x05);
  assert.equal(sweep.bins.length, 64);
  assert.equal(sweep.bins[0], -120);
  assert.equal(sweep.bins[63], -57);
});

test('sweep decoder rejects any bin count other than 64', () => {
  const parser = new FrameParser();
  const [frame] = parser.push(encodeFrame(MESSAGE.SWEEP, 1, sweepPayload({ bins: 63 })));
  assert.throws(() => decodeSweep(frame), /64 bins/i);
});

test('parser rejects unsupported versions and bad CRC frames', () => {
  const parser = new FrameParser();
  const unsupported = encodeFrame(MESSAGE.STATUS, 1, Uint8Array.of(1));
  unsupported[4] = 2;
  const badCrc = encodeFrame(MESSAGE.STATUS, 2, Uint8Array.of(2));
  badCrc[10] ^= 0xff;

  assert.deepEqual(parser.push(unsupported), []);
  assert.deepEqual(parser.push(badCrc), []);
  assert.equal(parser.stats.unsupportedVersion, 1);
  assert.equal(parser.stats.crcErrors, 1);
});

test('parser reconstructs a frame delivered one byte at a time', () => {
  const parser = new FrameParser();
  const encoded = encodeFrame(MESSAGE.STATUS, 44, Uint8Array.of(7, 8, 9));
  const frames = [];
  for (const byte of encoded) frames.push(...parser.push(Uint8Array.of(byte)));
  assert.deepEqual(frames.map((frame) => frame.sequence), [44]);
});

test('parser emits every concatenated frame in order', () => {
  const parser = new FrameParser();
  const first = encodeFrame(MESSAGE.STATUS, 10, Uint8Array.of(1));
  const second = encodeFrame(MESSAGE.PONG, 11, Uint8Array.of(2));
  const joined = new Uint8Array(first.length + second.length);
  joined.set(first);
  joined.set(second, first.length);
  assert.deepEqual(parser.push(joined).map((frame) => frame.sequence), [10, 11]);
});

test('parser skips garbage and retains a partial magic suffix', () => {
  const parser = new FrameParser();
  assert.deepEqual(parser.push(Uint8Array.of(0xde, 0xad, 0x53, 0x4c)), []);
  const valid = encodeFrame(MESSAGE.STATUS, 19, Uint8Array.of(3));
  const remainder = new Uint8Array(2 + valid.length - 4);
  remainder.set(Uint8Array.of(0x4e, 0x4b));
  remainder.set(valid.slice(4), 2);
  assert.deepEqual(parser.push(remainder).map((frame) => frame.sequence), [19]);
  assert.equal(parser.stats.discardedBytes, 2);
});

test('parser resynchronizes after a corrupt frame in the same chunk', () => {
  const parser = new FrameParser();
  const corrupt = encodeFrame(MESSAGE.STATUS, 20, Uint8Array.of(4));
  corrupt[10] ^= 0x80;
  const valid = encodeFrame(MESSAGE.STATUS, 21, Uint8Array.of(5));
  const joined = new Uint8Array(corrupt.length + valid.length);
  joined.set(corrupt);
  joined.set(valid, corrupt.length);
  assert.deepEqual(parser.push(joined).map((frame) => frame.sequence), [21]);
  assert.equal(parser.stats.crcErrors, 1);
});

test('parser handles deterministic irregular chunk boundaries', () => {
  const parser = new FrameParser();
  const frames = [1, 2, 3].map((sequence) => encodeFrame(MESSAGE.STATUS, sequence, Uint8Array.of(sequence)));
  const joined = new Uint8Array(frames.reduce((sum, frame) => sum + frame.length, 0));
  let offset = 0;
  for (const frame of frames) {
    joined.set(frame, offset);
    offset += frame.length;
  }
  const decoded = [];
  offset = 0;
  for (const size of [2, 7, 1, 13, 5, 64]) {
    decoded.push(...parser.push(joined.slice(offset, offset + size)));
    offset += size;
    if (offset >= joined.length) break;
  }
  if (offset < joined.length) decoded.push(...parser.push(joined.slice(offset)));
  assert.deepEqual(decoded.map((frame) => frame.sequence), [1, 2, 3]);
});


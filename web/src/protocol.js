import { crc16Ccitt } from './crc16.js';

export const PROTOCOL_VERSION = 1;
export const MAX_PAYLOAD = 192;
export const HEADER_SIZE = 10;
export const FRAME_OVERHEAD = 12;

export const MESSAGE = Object.freeze({
  HELLO: 0x01,
  SWEEP: 0x02,
  STATUS: 0x03,
  SET_CENTER: 0x80,
  SET_SPAN: 0x81,
  PAUSE: 0x82,
  RESUME: 0x83,
  MONITOR: 0x84,
  STOP_MONITOR: 0x85,
  PING: 0x86,
  PONG: 0x87,
});

const MAGIC = Uint8Array.of(0x53, 0x4c, 0x4e, 0x4b);

export function encodeFrame(type, sequence, payload = new Uint8Array()) {
  if (!(payload instanceof Uint8Array)) throw new TypeError('payload must be Uint8Array');
  if (payload.length > MAX_PAYLOAD) throw new RangeError('payload exceeds wire limit');
  if (!Number.isInteger(type) || type < 0 || type > 0xff) throw new RangeError('invalid message type');
  if (!Number.isInteger(sequence) || sequence < 0 || sequence > 0xffff) throw new RangeError('invalid sequence');

  const frame = new Uint8Array(FRAME_OVERHEAD + payload.length);
  frame.set(MAGIC, 0);
  frame[4] = PROTOCOL_VERSION;
  frame[5] = type;
  const view = new DataView(frame.buffer);
  view.setUint16(6, payload.length, true);
  view.setUint16(8, sequence, true);
  frame.set(payload, HEADER_SIZE);
  view.setUint16(HEADER_SIZE + payload.length, crc16Ccitt(frame.subarray(0, HEADER_SIZE + payload.length)), true);
  return frame;
}

function magicAt(bytes, offset) {
  return MAGIC.every((byte, index) => bytes[offset + index] === byte);
}

function magicIndex(bytes) {
  for (let index = 0; index <= bytes.length - MAGIC.length; index += 1) {
    if (magicAt(bytes, index)) return index;
  }
  return -1;
}

function retainedMagicPrefix(bytes) {
  const max = Math.min(MAGIC.length - 1, bytes.length);
  for (let count = max; count > 0; count -= 1) {
    let matches = true;
    for (let index = 0; index < count; index += 1) {
      if (bytes[bytes.length - count + index] !== MAGIC[index]) {
        matches = false;
        break;
      }
    }
    if (matches) return bytes.slice(bytes.length - count);
  }
  return new Uint8Array();
}

export class FrameParser {
  #buffer = new Uint8Array();

  stats = {
    crcErrors: 0,
    lengthErrors: 0,
    unsupportedVersion: 0,
    discardedBytes: 0,
  };

  push(chunk) {
    if (!(chunk instanceof Uint8Array)) throw new TypeError('chunk must be Uint8Array');
    const joined = new Uint8Array(this.#buffer.length + chunk.length);
    joined.set(this.#buffer);
    joined.set(chunk, this.#buffer.length);
    this.#buffer = joined;

    const frames = [];
    while (this.#buffer.length > 0) {
      const start = magicIndex(this.#buffer);
      if (start < 0) {
        const retained = retainedMagicPrefix(this.#buffer);
        this.stats.discardedBytes += this.#buffer.length - retained.length;
        this.#buffer = retained;
        break;
      }
      if (start > 0) {
        this.stats.discardedBytes += start;
        this.#buffer = this.#buffer.slice(start);
      }
      if (this.#buffer.length < HEADER_SIZE) break;

      const view = new DataView(this.#buffer.buffer, this.#buffer.byteOffset, this.#buffer.byteLength);
      const version = this.#buffer[4];
      const payloadLength = view.getUint16(6, true);
      if (version !== PROTOCOL_VERSION) {
        this.stats.unsupportedVersion += 1;
        this.#buffer = this.#buffer.slice(1);
        continue;
      }
      if (payloadLength > MAX_PAYLOAD) {
        this.stats.lengthErrors += 1;
        this.#buffer = this.#buffer.slice(1);
        continue;
      }
      const frameLength = FRAME_OVERHEAD + payloadLength;
      if (this.#buffer.length < frameLength) break;
      const expectedCrc = view.getUint16(HEADER_SIZE + payloadLength, true);
      const actualCrc = crc16Ccitt(this.#buffer.subarray(0, HEADER_SIZE + payloadLength));
      if (expectedCrc !== actualCrc) {
        this.stats.crcErrors += 1;
        this.#buffer = this.#buffer.slice(1);
        continue;
      }
      frames.push({
        version,
        type: this.#buffer[5],
        sequence: view.getUint16(8, true),
        payload: this.#buffer.slice(HEADER_SIZE, HEADER_SIZE + payloadLength),
      });
      this.#buffer = this.#buffer.slice(frameLength);
    }
    return frames;
  }
}

export function decodeSweep(frame) {
  if (frame.type !== MESSAGE.SWEEP) throw new TypeError('frame is not a sweep');
  if (frame.payload.length < 10) throw new RangeError('sweep payload is truncated');
  const view = new DataView(frame.payload.buffer, frame.payload.byteOffset, frame.payload.byteLength);
  const binCount = frame.payload[6];
  if (binCount !== 64) throw new RangeError('sweep must contain exactly 64 bins');
  if (frame.payload.length !== 10 + binCount) throw new RangeError('sweep payload length does not match bin count');
  const peakIndex = frame.payload[7];
  if (peakIndex >= binCount) throw new RangeError('peak index is outside sweep');

  const bins = new Int8Array(binCount);
  for (let index = 0; index < binCount; index += 1) bins[index] = view.getInt8(10 + index);
  return {
    sequence: frame.sequence,
    centerHz: view.getUint32(0, true) * 10,
    stepHz: view.getUint16(4, true) * 10,
    peakIndex,
    flags: frame.payload[8],
    bins,
  };
}

export function decodeHello(frame) {
  if (frame.type !== MESSAGE.HELLO) throw new TypeError('frame is not HELLO');
  if (frame.payload.length !== 6) throw new RangeError('HELLO length must be 6 bytes');
  const [abi, api, bins, spanMask, major, minor] = frame.payload;
  if (abi !== 1) throw new RangeError(`incompatible ABI ${abi}`);
  if (api < 3) throw new RangeError(`incompatible API ${api}; API 3 required`);
  if (bins !== 64) throw new RangeError('HELLO must advertise 64 bins');
  if ((spanMask & 0x0f) !== 0x0f) throw new RangeError('HELLO does not support all four spans');
  return { abi, api, bins, spanMask, appVersion: `${major}.${minor}` };
}

export function decodeStatus(frame) {
  if (frame.type !== MESSAGE.STATUS) throw new TypeError('frame is not STATUS');
  if (frame.payload.length !== 8) throw new RangeError('STATUS length must be 8 bytes');
  const view = new DataView(frame.payload.buffer, frame.payload.byteOffset, frame.payload.byteLength);
  return {
    mode: frame.payload[0],
    flags: frame.payload[1],
    droppedFrames: view.getUint16(2, true),
    crcErrors: view.getUint16(4, true),
    lengthErrors: view.getUint16(6, true),
  };
}


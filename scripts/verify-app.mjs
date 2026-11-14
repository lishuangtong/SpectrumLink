import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { crc32 } from 'node:zlib';

const path = process.argv[2];
if (!path) throw new Error('usage: node verify-app.mjs <SpectrumLink.app>');
const blob = readFileSync(path);
assert.ok(blob.length >= 65, 'artifact is empty or truncated');
assert.equal(blob.subarray(0, 4).toString('ascii'), 'FAP1', 'header magic');
assert.equal(blob.readUInt16LE(4), 1, 'header version');
assert.equal(blob.readUInt8(6), 1, 'ABI major');

const apiMinimum = blob.readUInt8(7);
const codeSize = blob.readUInt32LE(8);
const expectedCrc = blob.readUInt32LE(12);
const name = blob.subarray(20, 36).toString('ascii').replace(/\0.*$/, '');
const vma = blob.readUInt32LE(52);
const capabilities = blob.readUInt32LE(56);
const assetSize = blob.readUInt16LE(60);
const code = blob.subarray(64, 64 + codeSize);

assert.equal(name, 'SpectrumLink'); console.log('PASS name: SpectrumLink');
assert.equal(apiMinimum, 3); console.log('PASS API minimum: 3');
assert.ok((capabilities & 0x40) !== 0); console.log('PASS capability: serial');
assert.equal(vma, 0x20000280); console.log('PASS VMA: 0x20000280');
assert.ok(codeSize > 0 && codeSize <= 4096); console.log(`PASS code size: ${codeSize}/4096 bytes`);
assert.equal(blob.length, 64 + codeSize + assetSize); console.log('PASS artifact length');
assert.equal(crc32(code) >>> 0, expectedCrc); console.log(`PASS CRC-32: 0x${expectedCrc.toString(16).padStart(8, '0')}`);


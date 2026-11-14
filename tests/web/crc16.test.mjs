import assert from 'node:assert/strict';
import test from 'node:test';

import { crc16Ccitt } from '../../web/src/crc16.js';

test('CRC-16/CCITT-FALSE matches the standard check vector', () => {
  const bytes = new TextEncoder().encode('123456789');
  assert.equal(crc16Ccitt(bytes), 0x29b1);
});


import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';

import { createSpectrumServer } from '../scripts/serve.mjs';

function legacyGlbFixture() {
  const json = JSON.stringify({ asset: { version: '1.0' }, scene: 'scene0', scenes: { scene0: { nodes: [] } }, nodes: {} });
  const jsonBytes = new TextEncoder().encode(json);
  const paddedLength = Math.ceil(jsonBytes.length / 4) * 4;
  const bytes = new Uint8Array(20 + paddedLength); bytes.fill(0x20, 20);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, 0x46546c67, true); view.setUint32(4, 1, true); view.setUint32(8, bytes.length, true);
  view.setUint32(12, paddedLength, true); view.setUint32(16, 0, true); bytes.set(jsonBytes, 20);
  return bytes;
}

function currentGlbFixture() {
  const bytes = new Uint8Array(12);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, 0x46546c67, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, bytes.length, true);
  return bytes;
}

async function withServer(fetchFn, fn) {
  const server = createSpectrumServer({ fetchFn });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    const { port } = server.address();
    await fn(`http://127.0.0.1:${port}`);
  } finally {
    server.close();
    await once(server, 'close');
  }
}

test('aircraft API validates coordinates and radius before calling upstream', async () => {
  let calls = 0;
  await withServer(async () => { calls += 1; }, async (base) => {
    const response = await fetch(`${base}/api/aircraft?lat=1000&lon=121&radius=80`);
    assert.equal(response.status, 400);
    assert.equal(calls, 0);
  });
});

test('aircraft API proxies a bounded adsb.lol point request and returns only aircraft rows', async () => {
  let requestedUrl = '';
  await withServer(async (url) => {
    requestedUrl = String(url);
    return new Response(JSON.stringify({ ac: [{ hex: '780abc', lat: 31.2, lon: 121.5 }], total: 1 }), { status: 200 });
  }, async (base) => {
    const response = await fetch(`${base}/api/aircraft?lat=31.23&lon=121.47&radius=80`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { aircraft: [{ hex: '780abc', lat: 31.2, lon: 121.5 }], source: 'adsb.lol' });
  });
  assert.equal(requestedUrl, 'https://api.adsb.lol/v2/point/31.23/121.47/80');
});

test('aircraft API bounds upstream failures without leaking their body', async () => {
  await withServer(async () => new Response('upstream secret', { status: 503 }), async (base) => {
    const response = await fetch(`${base}/api/aircraft?lat=31.23&lon=121.47&radius=80`);
    assert.equal(response.status, 502);
    assert.deepEqual(await response.json(), { error: 'Aircraft data unavailable' });
  });
});

test('aircraft API falls back to adsb.fi and normalizes its response shape', async () => {
  const calls = [];
  await withServer(async (url) => {
    calls.push(String(url));
    if (String(url).includes('adsb.lol')) return new Response('down', { status: 503 });
    return new Response(JSON.stringify({ aircraft: [{ hex: '78131d', flight: 'CBJ456', lat: 36.03, lon: 109.81 }] }), { status: 200 });
  }, async (base) => {
    const response = await fetch(`${base}/api/aircraft?lat=37.825044&lon=112.517125&radius=250`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { aircraft: [{ hex: '78131d', flight: 'CBJ456', lat: 36.03, lon: 109.81 }], source: 'adsb.fi' });
  });
  assert.equal(calls.length, 2);
});

test('aircraft detail API combines ADSBDB aircraft and route records', async () => {
  await withServer(async (url) => {
    const value = String(url);
    if (value.endsWith('/aircraft/780C3D')) return new Response(JSON.stringify({ response: { aircraft: { type: 'A320 232SL', manufacturer: 'Airbus', registration: 'B-1829' } } }), { status: 200 });
    if (value.endsWith('/callsign/CSN8910')) return new Response(JSON.stringify({ response: { flightroute: { airline: { name: 'China Southern Airlines' }, origin: { iata_code: 'SYX' }, destination: { iata_code: 'PKX' } } } }), { status: 200 });
    return new Response('not found', { status: 404 });
  }, async (base) => {
    const response = await fetch(`${base}/api/aircraft/detail?icao=780c3d&callsign=csn8910`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      aircraft: { type: 'A320 232SL', manufacturer: 'Airbus', registration: 'B-1829' },
      route: { airline: { name: 'China Southern Airlines' }, origin: { iata_code: 'SYX' }, destination: { iata_code: 'PKX' } },
      source: 'adsbdb',
    });
  });
});

test('aircraft detail API rejects malformed identifiers without upstream calls', async () => {
  let calls = 0;
  await withServer(async () => { calls += 1; }, async (base) => {
    const response = await fetch(`${base}/api/aircraft/detail?icao=../../bad&callsign=<script>`);
    assert.equal(response.status, 400);
    assert.equal(calls, 0);
  });
});

test('terrain tilejson keeps the browser on localhost and declares real terrarium elevation', async () => {
  await withServer(async () => { throw new Error('tilejson must be local'); }, async (base) => {
    const response = await fetch(`${base}/api/terrain/tilejson.json`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.encoding, 'terrarium');
    assert.equal(body.tileSize, 512);
    assert.match(body.attribution, /Mapterhorn/);
    assert.equal(body.tiles[0], `${base}/api/terrain/{z}/{x}/{y}.webp`);
  });
});

test('terrain proxy validates and caches global elevation tiles', async () => {
  const calls = [];
  const bytes = Uint8Array.from([82, 73, 70, 70, 1, 2, 3, 4]);
  await withServer(async (url) => {
    calls.push(String(url));
    return new Response(bytes, { status: 200, headers: { 'content-type': 'image/webp' } });
  }, async (base) => {
    const first = await fetch(`${base}/api/terrain/9/416/197.webp`);
    assert.equal(first.status, 200);
    assert.equal(first.headers.get('content-type'), 'image/webp');
    assert.deepEqual(new Uint8Array(await first.arrayBuffer()), bytes);
    const cached = await fetch(`${base}/api/terrain/9/416/197.webp`);
    assert.equal(cached.status, 200);
    const invalid = await fetch(`${base}/api/terrain/9/9999/197.webp`);
    assert.equal(invalid.status, 400);
  });
  assert.deepEqual(calls, ['https://tiles.mapterhorn.com/9/416/197.webp']);
});

test('imagery proxy keeps NASA satellite tiles local, validates coordinates, and caches them', async () => {
  const calls = [];
  const bytes = Uint8Array.from([255, 216, 255, 224, 1, 2, 3, 4]);
  await withServer(async (url) => {
    calls.push(String(url));
    return new Response(bytes, { status: 200, headers: { 'content-type': 'image/jpeg' } });
  }, async (base) => {
    const first = await fetch(`${base}/api/imagery/8/208/98.jpeg`);
    assert.equal(first.status, 200);
    assert.equal(first.headers.get('content-type'), 'image/jpeg');
    assert.deepEqual(new Uint8Array(await first.arrayBuffer()), bytes);
    const cached = await fetch(`${base}/api/imagery/8/208/98.jpeg`);
    assert.equal(cached.status, 200);
    const invalid = await fetch(`${base}/api/imagery/8/9999/98.jpeg`);
    assert.equal(invalid.status, 400);
  });
  assert.deepEqual(calls, [
    'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_NextGeneration/default/GoogleMapsCompatible_Level8/8/98/208.jpeg',
  ]);
});

test('aircraft model API proxies allowlisted GLBs with provider and license headers', async () => {
  const bytes = legacyGlbFixture();
  let requestedUrl = '';
  await withServer(async (url) => {
    requestedUrl = String(url);
    return new Response(bytes, { status: 200, headers: { 'content-type': 'application/octet-stream' } });
  }, async (base) => {
    const response = await fetch(`${base}/api/aircraft/model?type=A333`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'model/gltf-binary');
    assert.match(response.headers.get('cache-control'), /max-age=86400/);
    assert.match(response.headers.get('link'), /Flightradar24\/fr24-3d-models/);
    assert.equal(response.headers.get('x-aircraft-model-provider'), 'fr24');
    assert.equal(response.headers.get('x-aircraft-model-license'), 'GPL-2.0');
    const upgraded = await response.arrayBuffer();
    assert.equal(new DataView(upgraded).getUint32(0, true), 0x46546c67);
    assert.equal(new DataView(upgraded).getUint32(4, true), 2);
  });
  assert.equal(requestedUrl, 'https://ghproxy.net/https://raw.githubusercontent.com/Flightradar24/fr24-3d-models/dd53267690c6a4ecbb290a3acf0284333a5d68a9/models/a333.glb');
});

test('aircraft model API routes AMV and Gods Eye View assets to pinned sources', async () => {
  const requested = [];
  await withServer(async (url) => {
    requested.push(String(url));
    return new Response(currentGlbFixture(), { status: 200 });
  }, async (base) => {
    const amv = await fetch(`${base}/api/aircraft/model?type=A320`);
    assert.equal(amv.headers.get('x-aircraft-model-provider'), 'amvlab');
    assert.equal(amv.headers.get('x-aircraft-model-license'), 'CC BY 4.0');
    const gods = await fetch(`${base}/api/aircraft/model?type=AT76`);
    assert.equal(gods.headers.get('x-aircraft-model-provider'), 'gods-eye-view');
    assert.equal(gods.headers.get('x-aircraft-model-license'), 'CC BY 4.0');
  });
  assert.deepEqual(requested, [
    'https://cdn.jsdelivr.net/gh/amvlab/aircraft-models@91d835e8e851b2317fe79af291c9fed6153fd525/models/A320_nologo.glb',
    'https://cdn.jsdelivr.net/gh/bilawalsidhu/gods-eye-view@d544613aaeb25efc06eab7f62731b99eb909c18f/public/models/atr72.glb',
  ]);
});

test('aircraft model API rejects unsupported types and path input without making an upstream request', async () => {
  let calls = 0;
  await withServer(async () => { calls += 1; }, async (base) => {
    const response = await fetch(`${base}/api/aircraft/model?type=C919`);
    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { error: 'Aircraft model unavailable' });
    const pathResponse = await fetch(`${base}/api/aircraft/model?type=..%2F..%2Fa320`);
    assert.equal(pathResponse.status, 404);
  });
  assert.equal(calls, 0);
});

test('aircraft model API bounds upstream model failures', async () => {
  await withServer(async () => new Response('upstream details', { status: 503 }), async (base) => {
    const response = await fetch(`${base}/api/aircraft/model?type=B738`);
    assert.equal(response.status, 502);
    assert.deepEqual(await response.json(), { error: 'Aircraft model unavailable' });
  });
});

test('aircraft model API retries one transient CDN failure before falling back', async () => {
  let calls = 0;
  await withServer(async () => {
    calls += 1;
    return calls === 1 ? new Response('temporary', { status: 503 }) : new Response(currentGlbFixture(), { status: 200 });
  }, async (base) => {
    const response = await fetch(`${base}/api/aircraft/model?type=B744`);
    assert.equal(response.status, 200);
  });
  assert.equal(calls, 2);
});

test('aircraft model API evicts old models from its bounded provider-aware conversion cache', async () => {
  const requested = [];
  const types = ['A318', 'A319', 'A320', 'A321', 'A332', 'A333', 'A343', 'A346', 'A359'];
  await withServer(async (url) => {
    requested.push(String(url));
    return new Response(currentGlbFixture(), { status: 200 });
  }, async (base) => {
    for (const type of types) {
      const response = await fetch(`${base}/api/aircraft/model?type=${type}`);
      assert.equal(response.status, 200);
    }
    const firstAgain = await fetch(`${base}/api/aircraft/model?type=A318`);
    assert.equal(firstAgain.status, 200);
  });
  assert.equal(requested.length, 10);
});


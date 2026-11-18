import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import gltfPipeline from 'gltf-pipeline';

import { aircraftModelAsset } from '../web/src/aircraft-model-assets.js';

const defaultRoot = fileURLToPath(new URL('../web/', import.meta.url));
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json' };

function json(response, status, body) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  response.end(JSON.stringify(body));
}

async function fetchJson(fetchFn, endpoint) {
  const upstream = await fetchFn(endpoint, { headers: { accept: 'application/json', 'user-agent': 'SpectrumLink/0.3' }, signal: AbortSignal.timeout(8000) });
  if (!upstream.ok) throw new Error(`upstream ${upstream.status}`);
  return upstream.json();
}

export function resolveListenOptions(env = process.env) {
  const allowedHosts = new Set(['127.0.0.1', '0.0.0.0', '::', 'localhost']);
  const requestedHost = String(env.SPECTRUMLINK_HOST || '127.0.0.1').trim();
  const requestedPort = Number(env.SPECTRUMLINK_PORT || 8765);
  return {
    host: allowedHosts.has(requestedHost) ? requestedHost : '127.0.0.1',
    port: Number.isInteger(requestedPort) && requestedPort >= 1 && requestedPort <= 65535 ? requestedPort : 8765,
  };
}

function requestOrigin(request) {
  const forwardedProto = String(request.headers['x-forwarded-proto'] || '').split(',')[0].trim().toLowerCase();
  const protocol = forwardedProto === 'https' ? 'https' : 'http';
  const forwardedHost = String(request.headers['x-forwarded-host'] || '').split(',')[0].trim();
  const directHost = String(request.headers.host || '127.0.0.1:8765').trim();
  const safeHost = (value) => /^(?:[a-z0-9.-]+|\[[0-9a-f:]+\])(?::\d{1,5})?$/i.test(value);
  const host = safeHost(forwardedHost) ? forwardedHost : (safeHost(directHost) ? directHost : '127.0.0.1:8765');
  return `${protocol}://${host}`;
}

export function createSpectrumServer({ fetchFn = globalThis.fetch, root = defaultRoot } = {}) {
  const modelCache = new Map();
  const terrainCache = new Map();
  const imageryCache = new Map();
  const loadTerrainTile = (z, x, y) => {
    const cacheKey = `${z}/${x}/${y}`;
    if (terrainCache.has(cacheKey)) {
      const cached = terrainCache.get(cacheKey);
      terrainCache.delete(cacheKey);
      terrainCache.set(cacheKey, cached);
      return cached;
    }
    const pending = (async () => {
      const upstream = await fetchFn(`https://tiles.mapterhorn.com/${z}/${x}/${y}.webp`, {
        headers: { accept: 'image/webp,image/*', 'user-agent': 'SpectrumLink/0.4' },
        signal: AbortSignal.timeout(20000),
      });
      if (!upstream.ok) throw new Error(`upstream ${upstream.status}`);
      const bytes = Buffer.from(await upstream.arrayBuffer());
      if (bytes.byteLength > 2 * 1024 * 1024) throw new Error('terrain tile too large');
      return bytes;
    })();
    terrainCache.set(cacheKey, pending);
    while (terrainCache.size > 96) terrainCache.delete(terrainCache.keys().next().value);
    pending.catch(() => {
      if (terrainCache.get(cacheKey) === pending) terrainCache.delete(cacheKey);
    });
    return pending;
  };
  const loadImageryTile = (z, x, y) => {
    const cacheKey = `${z}/${x}/${y}`;
    if (imageryCache.has(cacheKey)) {
      const cached = imageryCache.get(cacheKey);
      imageryCache.delete(cacheKey);
      imageryCache.set(cacheKey, cached);
      return cached;
    }
    const pending = (async () => {
      const endpoint = `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_NextGeneration/default/GoogleMapsCompatible_Level8/${z}/${y}/${x}.jpeg`;
      const upstream = await fetchFn(endpoint, {
        headers: { accept: 'image/jpeg,image/*', 'user-agent': 'SpectrumLink/0.4' },
        signal: AbortSignal.timeout(20000),
      });
      if (!upstream.ok) throw new Error(`upstream ${upstream.status}`);
      const bytes = Buffer.from(await upstream.arrayBuffer());
      if (bytes.byteLength > 4 * 1024 * 1024) throw new Error('imagery tile too large');
      return bytes;
    })();
    imageryCache.set(cacheKey, pending);
    while (imageryCache.size > 96) imageryCache.delete(imageryCache.keys().next().value);
    pending.catch(() => {
      if (imageryCache.get(cacheKey) === pending) imageryCache.delete(cacheKey);
    });
    return pending;
  };
  const loadAircraftModel = (asset) => {
    const cacheKey = `${asset.provider}:${asset.filename}`;
    if (modelCache.has(cacheKey)) {
      const cached = modelCache.get(cacheKey);
      modelCache.delete(cacheKey);
      modelCache.set(cacheKey, cached);
      return cached;
    }
    const pending = (async () => {
      let upstream;
      for (let attempt = 0; attempt < 2; attempt += 1) {
        upstream = await fetchFn(asset.sourceUrl, {
          headers: { accept: 'model/gltf-binary,application/octet-stream', 'user-agent': 'SpectrumLink/0.4' },
          signal: AbortSignal.timeout(90000),
        });
        if (upstream.ok) break;
      }
      if (!upstream?.ok) throw new Error(`upstream ${upstream?.status ?? 'unavailable'}`);
      const bytes = Buffer.from(await upstream.arrayBuffer());
      if (bytes.byteLength > 12 * 1024 * 1024) throw new Error('model too large');
      const version = bytes.byteLength >= 8 ? bytes.readUInt32LE(4) : 0;
      if (version === 2) return bytes;
      return (await gltfPipeline.processGlb(bytes)).glb;
    })();
    modelCache.set(cacheKey, pending);
    while (modelCache.size > 8) modelCache.delete(modelCache.keys().next().value);
    pending.catch(() => {
      if (modelCache.get(cacheKey) === pending) modelCache.delete(cacheKey);
    });
    return pending;
  };
  return createServer(async (request, response) => {
    const url = new URL(request.url, 'http://localhost');
    if (url.pathname === '/healthz') {
      json(response, 200, { status: 'ok', service: 'spectrumlink' });
      return;
    }
    if (url.pathname === '/api/terrain/tilejson.json') {
      json(response, 200, {
        tilejson: '3.0.0',
        scheme: 'xyz',
        tiles: [`${requestOrigin(request)}/api/terrain/{z}/{x}/{y}.webp`],
        attribution: 'Terrain: Mapterhorn open elevation tiles',
        bounds: [-180, -85.0511287, 180, 85.0511287],
        center: [112.517125, 37.825044, 8],
        minzoom: 0,
        maxzoom: 12,
        encoding: 'terrarium',
        tileSize: 512,
      });
      return;
    }

    const terrainMatch = url.pathname.match(/^\/api\/terrain\/(\d+)\/(\d+)\/(\d+)\.webp$/);
    if (terrainMatch) {
      const [, zText, xText, yText] = terrainMatch;
      const z = Number(zText);
      const x = Number(xText);
      const y = Number(yText);
      const side = 2 ** z;
      if (z < 0 || z > 12 || x < 0 || x >= side || y < 0 || y >= side) {
        json(response, 400, { error: 'Invalid terrain tile' });
        return;
      }
      try {
        const bytes = await loadTerrainTile(z, x, y);
        response.writeHead(200, {
          'content-type': 'image/webp',
          'content-length': String(bytes.byteLength),
          'cache-control': 'public, max-age=86400, stale-while-revalidate=604800',
          link: '<https://tiles.mapterhorn.com/>; rel="source attribution"',
        });
        response.end(bytes);
      } catch {
        json(response, 502, { error: 'Terrain tile unavailable' });
      }
      return;
    }

    const imageryMatch = url.pathname.match(/^\/api\/imagery\/(\d+)\/(\d+)\/(\d+)\.jpeg$/);
    if (imageryMatch) {
      const [, zText, xText, yText] = imageryMatch;
      const z = Number(zText);
      const x = Number(xText);
      const y = Number(yText);
      const side = 2 ** z;
      if (z < 0 || z > 8 || x < 0 || x >= side || y < 0 || y >= side) {
        json(response, 400, { error: 'Invalid imagery tile' });
        return;
      }
      try {
        const bytes = await loadImageryTile(z, x, y);
        response.writeHead(200, {
          'content-type': 'image/jpeg',
          'content-length': String(bytes.byteLength),
          'cache-control': 'public, max-age=86400, stale-while-revalidate=604800',
          link: '<https://gibs.earthdata.nasa.gov/>; rel="source attribution"',
        });
        response.end(bytes);
      } catch {
        json(response, 502, { error: 'Imagery tile unavailable' });
      }
      return;
    }

    if (url.pathname === '/api/aircraft') {
      const lat = Number(url.searchParams.get('lat'));
      const lon = Number(url.searchParams.get('lon'));
      const radius = Number(url.searchParams.get('radius'));
      if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lon) || lon < -180 || lon > 180 || !Number.isFinite(radius) || radius < 5 || radius > 250) {
        json(response, 400, { error: 'Invalid aircraft query' });
        return;
      }
      try {
        const payload = await fetchJson(fetchFn, `https://api.adsb.lol/v2/point/${lat}/${lon}/${Math.round(radius)}`);
        json(response, 200, { aircraft: Array.isArray(payload.ac) ? payload.ac.slice(0, 250) : [], source: 'adsb.lol' });
      } catch (primaryError) {
        try {
          const payload = await fetchJson(fetchFn, `https://opendata.adsb.fi/api/v2/lat/${lat}/lon/${lon}/dist/${Math.round(radius)}`);
          json(response, 200, { aircraft: Array.isArray(payload.aircraft) ? payload.aircraft.slice(0, 250) : [], source: 'adsb.fi' });
        } catch {
          json(response, 502, { error: 'Aircraft data unavailable' });
        }
      }
      return;
    }

    if (url.pathname === '/api/aircraft/detail') {
      const icao = String(url.searchParams.get('icao') || '').trim().toUpperCase();
      const callsign = String(url.searchParams.get('callsign') || '').trim().toUpperCase();
      const validIcao = /^[0-9A-F]{6}$/.test(icao);
      const validCallsign = /^[A-Z0-9-]{1,12}$/.test(callsign);
      if (!validIcao && !validCallsign) {
        json(response, 400, { error: 'Invalid aircraft identifiers' });
        return;
      }
      const read = async (endpoint, key) => {
        try {
          const payload = await fetchJson(fetchFn, endpoint);
          return payload?.response?.[key] || null;
        } catch { return null; }
      };
      const [aircraft, route] = await Promise.all([
        validIcao ? read(`https://api.adsbdb.com/v0/aircraft/${icao}`, 'aircraft') : null,
        validCallsign ? read(`https://api.adsbdb.com/v0/callsign/${callsign}`, 'flightroute') : null,
      ]);
      if (!aircraft && !route) {
        json(response, 502, { error: 'Aircraft detail unavailable' });
        return;
      }
      json(response, 200, { aircraft, route, source: 'adsbdb' });
      return;
    }

    if (url.pathname === '/api/aircraft/model') {
      const asset = aircraftModelAsset(url.searchParams.get('type'));
      if (!asset) {
        json(response, 404, { error: 'Aircraft model unavailable' });
        return;
      }
      try {
        const bytes = await loadAircraftModel(asset);
        response.writeHead(200, {
          'content-type': 'model/gltf-binary',
          'content-length': String(bytes.byteLength),
          'cache-control': 'public, max-age=86400, stale-while-revalidate=604800',
          link: `<${asset.sourcePage}>; rel="source license"`,
          'x-aircraft-model-provider': asset.provider,
          'x-aircraft-model-license': asset.license,
        });
        response.end(bytes);
      } catch {
        json(response, 502, { error: 'Aircraft model unavailable' });
      }
      return;
    }

    const pathname = decodeURIComponent(url.pathname);
    const relative = normalize(pathname === '/' ? 'index.html' : pathname.slice(1));
    const file = join(root, relative);
    if (!file.startsWith(root)) { response.writeHead(403).end('Forbidden'); return; }
    try {
      if (!statSync(file).isFile()) throw new Error('not file');
      response.writeHead(200, { 'content-type': types[extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
      createReadStream(file).pipe(response);
    } catch { response.writeHead(404).end('Not found'); }
  });
}

const isEntry = process.argv[1] && fileURLToPath(import.meta.url) === normalize(process.argv[1]);
if (isEntry) {
  const { host, port } = resolveListenOptions();
  const server = createSpectrumServer();
  server.listen(port, host, () => console.log(`SpectrumLink: http://${host}:${port}`));
}


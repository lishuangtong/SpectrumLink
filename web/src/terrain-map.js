const DEFAULT_CAMERA = Object.freeze({ zoom: 8.6, pitch: 70, bearing: -28 });
const TERRAIN_FAILURE_THRESHOLD = 4;

export function shouldFallbackTerrain(errorCount, ready = false) {
  return !ready && errorCount >= TERRAIN_FAILURE_THRESHOLD;
}

export function terrainCamera({ longitude, latitude }) {
  const lon = Number(longitude);
  const lat = Number(latitude);
  return {
    center: [Number.isFinite(lon) ? lon : 112.517125, Number.isFinite(lat) ? lat : 37.825044],
    ...DEFAULT_CAMERA,
  };
}

export function terrainPresentationCamera({ longitude, latitude, heading, shotId, mode = 'open3d' }) {
  const base = terrainCamera({ longitude, latitude });
  const flightHeading = Number.isFinite(Number(heading)) ? Number(heading) : base.bearing;
  if (mode === 'flat2d') return { center: base.center, zoom: 10.2, pitch: 0, bearing: flightHeading };
  if (shotId === 'overhead') return { center: base.center, zoom: 9.7, pitch: 58, bearing: flightHeading };
  if (shotId === 'fly-by') return { center: base.center, zoom: 9.2, pitch: 72, bearing: flightHeading - 34 };
  return { center: base.center, zoom: 9, pitch: 68, bearing: flightHeading - 24 };
}

export function createTerrainStyle() {
  return {
    version: 8,
    sources: {
      imagery: {
        type: 'raster',
        tiles: ['/api/imagery/{z}/{x}/{y}.jpeg'],
        tileSize: 256,
        maxzoom: 8,
        attribution: 'Imagery: NASA Earth Observatory / GIBS Blue Marble',
      },
      terrain: {
        type: 'raster-dem',
        url: '/api/terrain/tilejson.json',
        attribution: 'Terrain: Mapterhorn open elevation tiles',
      },
      terrainHillshade: {
        type: 'raster-dem',
        url: '/api/terrain/tilejson.json',
      },
    },
    layers: [
      {
        id: 'sky-ground',
        type: 'background',
        paint: { 'background-color': '#07120f' },
      },
      {
        id: 'imagery',
        type: 'raster',
        source: 'imagery',
        paint: {
          'raster-saturation': -0.12,
          'raster-contrast': 0.14,
          'raster-brightness-min': 0.08,
          'raster-brightness-max': 0.82,
        },
      },
      {
        id: 'terrain-shade',
        type: 'hillshade',
        source: 'terrainHillshade',
        paint: {
          'hillshade-exaggeration': 0.24,
          'hillshade-shadow-color': '#051208',
          'hillshade-highlight-color': '#d7e6cf',
          'hillshade-accent-color': '#314936',
        },
      },
    ],
    terrain: { source: 'terrain', exaggeration: 1.15 },
  };
}

export function createTerrainMap({ maplibregl, container, longitude, latitude, onUnavailable }) {
  if (!maplibregl?.Map || !container) return null;
  const map = new maplibregl.Map({
    container,
    style: createTerrainStyle(),
    ...terrainCamera({ longitude, latitude }),
    interactive: false,
    attributionControl: true,
    fadeDuration: 650,
    antialias: true,
  });

  let terrainReady = false;
  map.on('load', () => {
    terrainReady = true;
    container.classList.add('is-terrain-ready');
  });
  let unavailableNotified = false;
  let terrainErrorCount = 0;
  map.on('error', () => {
    terrainErrorCount += 1;
    if (!shouldFallbackTerrain(terrainErrorCount, terrainReady)) return;
    container.classList.add('is-terrain-unavailable');
    if (!unavailableNotified) {
      unavailableNotified = true;
      onUnavailable?.();
    }
  });

  const observer = typeof ResizeObserver === 'function'
    ? new ResizeObserver(() => map.resize())
    : null;
  observer?.observe(container);

  let radioPosition = { longitude, latitude };
  let flightPosition = null;
  let activeShot = 'fly-by';
  let activeMode = 'open3d';
  const currentCamera = () => terrainPresentationCamera({ ...(flightPosition || radioPosition), shotId: activeShot, mode: activeMode });
  const updateCamera = (animate = true) => {
    const camera = currentCamera();
    if (animate && typeof map.easeTo === 'function') map.easeTo({ ...camera, duration: 900, essential: true });
    else map.jumpTo(camera);
  };

  return {
    map,
    resize: () => map.resize(),
    setCenter(nextLongitude, nextLatitude) {
      radioPosition = { longitude: nextLongitude, latitude: nextLatitude };
      if (!flightPosition) updateCamera(false);
    },
    setFlight(nextFlight) {
      flightPosition = nextFlight && Number.isFinite(Number(nextFlight.longitude)) && Number.isFinite(Number(nextFlight.latitude))
        ? { longitude: Number(nextFlight.longitude), latitude: Number(nextFlight.latitude), heading: nextFlight.heading }
        : null;
      updateCamera(true);
    },
    setPresentation(shotId) {
      activeShot = shotId || 'fly-by';
      updateCamera(true);
    },
    setMode(mode) {
      activeMode = mode === 'flat2d' ? 'flat2d' : 'open3d';
      updateCamera(true);
    },
    setVisible(visible) { container.hidden = !visible; if (visible) map.resize(); },
    destroy() {
      observer?.disconnect();
      map.remove();
    },
  };
}

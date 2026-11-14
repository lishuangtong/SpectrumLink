const STORAGE_KEY = 'spectrumlink.layout.v1';
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function clampDragPosition(x, y, bounds, module) {
  return {
    x: clamp(x, 0, Math.max(0, bounds.width - module.width)),
    y: clamp(y, 0, Math.max(0, bounds.height - module.height)),
  };
}

export function normalizePosition(position, bounds, module) {
  const maxX = Math.max(1, bounds.width - module.width);
  const maxY = Math.max(1, bounds.height - module.height);
  return {
    x: Math.round(clamp(position.x / maxX, 0, 1) * 10000) / 10000,
    y: Math.round(clamp(position.y / maxY, 0, 1) * 10000) / 10000,
  };
}

function sanitize(layout) {
  if (!layout || typeof layout !== 'object') return {};
  return Object.fromEntries(Object.entries(layout).filter(([, position]) => position && Number.isFinite(position.x) && Number.isFinite(position.y) && position.x >= 0 && position.x <= 1 && position.y >= 0 && position.y <= 1).map(([key, position]) => [key, { x: position.x, y: position.y }]));
}

export function loadModuleLayout(storage = globalThis.localStorage) {
  try { return sanitize(JSON.parse(storage?.getItem(STORAGE_KEY) || '{}')); } catch { return {}; }
}

export function saveModuleLayout(storage = globalThis.localStorage, layout) {
  const safe = sanitize(layout); storage?.setItem(STORAGE_KEY, JSON.stringify(safe)); return safe;
}

export function clearModuleLayout(storage = globalThis.localStorage) {
  storage?.removeItem?.(STORAGE_KEY);
}

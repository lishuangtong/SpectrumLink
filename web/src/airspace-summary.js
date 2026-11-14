const finiteOrNull = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' && !value.trim()) return null;
  return Number.isFinite(Number(value)) ? Number(value) : null;
};

export function buildAirspaceSummary(aircraft = [], options = {}) {
  const rows = Array.isArray(aircraft) ? aircraft : [];
  const nearest = rows
    .map((plane) => ({ plane, distanceKm: finiteOrNull(plane?.distanceKm) }))
    .filter(({ distanceKm }) => distanceKm !== null && distanceKm >= 0)
    .sort((a, b) => a.distanceKm - b.distanceKm)[0] ?? null;
  const altitudes = rows
    .map((plane) => finiteOrNull(plane?.altitudeFt))
    .filter((altitude) => altitude !== null);
  const latencyMs = finiteOrNull(options.latencyMs);
  const updatedAt = options.updatedAt instanceof Date && Number.isFinite(options.updatedAt.getTime())
    ? options.updatedAt
    : null;

  return {
    status: options.status === 'live' || options.status === 'error' ? options.status : 'loading',
    count: rows.length,
    nearestCallsign: nearest && String(nearest.plane?.callsign ?? '').trim() || null,
    nearestDistanceKm: nearest?.distanceKm ?? null,
    highestAltitudeFt: altitudes.length ? Math.max(...altitudes) : null,
    latencyMs: latencyMs !== null && latencyMs >= 0 ? latencyMs : null,
    updatedAt,
  };
}

export function formatAirspaceSummary(summary, { t, locale = 'zh-CN' }) {
  return {
    count: summary.status === 'live' ? t('airspace.countValue', { count: summary.count }) : '--',
    nearest: summary.nearestCallsign
      ? `${summary.nearestCallsign} · ${Math.round(summary.nearestDistanceKm)} km`
      : t(summary.status === 'error' ? 'airspace.unavailable' : 'airspace.waiting'),
    highest: summary.highestAltitudeFt === null
      ? '-- ft'
      : `${Math.round(summary.highestAltitudeFt).toLocaleString('en-US')} ft`,
    latency: summary.latencyMs === null
      ? '--'
      : `${(summary.latencyMs / 1000).toFixed(summary.latencyMs >= 1000 ? 1 : 2)} s`,
    updated: summary.updatedAt
      ? `${summary.updatedAt.toLocaleTimeString(locale, { hour12: false })} ${t('airspace.updated')}`
      : t(summary.status === 'error' ? 'airspace.interrupted' : 'airspace.pendingUpdate'),
  };
}

export function createLatestRequestGuard() {
  let generation = 0;
  return {
    begin() { generation += 1; return generation; },
    isCurrent(token) { return token === generation; },
  };
}

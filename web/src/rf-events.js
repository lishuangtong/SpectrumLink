const STORAGE_KEY = 'spectrumlink.rfEvents.v1';
const MAX_EVENTS = 100;

function normalizeRfEvents(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((row) => {
    const startedAt = Number(row?.startedAt);
    const endedAt = Number(row?.endedAt);
    const frequencyHz = Number(row?.frequencyHz);
    const peakDbm = Number(row?.peakDbm);
    const durationMs = Number(row?.durationMs);
    if (![startedAt, endedAt, frequencyHz, peakDbm, durationMs].every(Number.isFinite) || frequencyHz <= 0 || durationMs < 0) return [];
    return [{ startedAt, endedAt, frequencyHz, peakDbm: Math.round(peakDbm), durationMs: Math.round(durationMs) }];
  }).slice(0, MAX_EVENTS);
}

export function loadRfEvents(storage = globalThis.localStorage) {
  try { return normalizeRfEvents(JSON.parse(storage?.getItem(STORAGE_KEY) ?? '[]')); }
  catch { return []; }
}

export function saveRfEvents(storage = globalThis.localStorage, rows) {
  const normalized = normalizeRfEvents(rows);
  storage?.setItem(STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}

export function appendRfEvent(rows, event) {
  const normalized = normalizeRfEvents([event]);
  if (!normalized.length) return normalizeRfEvents(rows);
  return normalizeRfEvents([...normalized, ...normalizeRfEvents(rows)]);
}

export function formatRfEvent(event, locale = 'zh-CN') {
  const date = new Date(event.startedAt);
  const dateTime = Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat(locale, { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(date).replaceAll('/', '-')
    : '-- -- --:--';
  return {
    dateTime,
    frequency: `${(event.frequencyHz / 1e6).toFixed(4)} MHz`,
    peak: `${Math.round(event.peakDbm)} dBm`,
    duration: `${(Math.round(event.durationMs / 100) / 10).toFixed(1)} s`,
  };
}

export function renderRfEvents(container, rows, documentRef = document, { locale = 'zh-CN', emptyText = '等待信号活动' } = {}) {
  const events = normalizeRfEvents(rows);
  container.replaceChildren();
  const header = documentRef.createElement('div'); header.className = 'rf-event-head';
  for (const label of ['日期 / 时间', '频率', '峰值', '时长']) { const cell = documentRef.createElement('span'); cell.textContent = label; header.append(cell); }
  const track = documentRef.createElement('div'); track.className = 'rf-event-track';
  if (!events.length) {
    const empty = documentRef.createElement('p'); empty.className = 'rf-event-empty'; empty.textContent = emptyText; track.append(empty);
  } else {
    events.forEach((event) => {
      const values = formatRfEvent(event, locale);
      const row = documentRef.createElement('div'); row.className = 'rf-event-row';
      for (const value of [values.dateTime, values.frequency, values.peak, values.duration]) { const cell = documentRef.createElement('span'); cell.textContent = value; row.append(cell); }
      track.append(row);
    });
  }
  container.append(header, track);
  return events;
}


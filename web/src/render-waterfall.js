import { normalizeDbm } from './history.js';

const STOPS = [
  [0, [4, 10, 40]], [.14, [0, 38, 170]], [.28, [0, 196, 255]],
  [.4, [255, 246, 80]], [.58, [255, 160, 0]], [.76, [255, 42, 10]],
  [.9, [255, 0, 0]], [1, [255, 255, 255]],
];

export function sdrDisplayRange(bins) {
  const values = Array.from(bins || [], Number).filter(Number.isFinite).sort((a, b) => a - b);
  if (!values.length) return { floor: -120, ceiling: -40 };
  const noise = values[Math.floor((values.length - 1) * .25)];
  const peak = values.at(-1);
  const floor = Math.max(-128, Math.min(-18, Math.round(noise - 3)));
  const ceiling = Math.min(-5, Math.max(Math.round(noise + 18), Math.round(peak + 2)));
  return { floor, ceiling };
}

export function paletteColor(value, floor = -120, ceiling = -40) {
  const t = normalizeDbm(value, floor, ceiling);
  for (let index = 1; index < STOPS.length; index += 1) {
    if (t <= STOPS[index][0]) {
      const [aT, a] = STOPS[index - 1]; const [bT, b] = STOPS[index];
      const mix = (t - aT) / (bT - aT);
      return a.map((channel, i) => Math.round(channel + (b[i] - channel) * mix));
    }
  }
  return STOPS.at(-1)[1].slice();
}

export function sampleWaterfallBin(bins, normalizedX) {
  const position = Math.max(0, Math.min(1, Number(normalizedX) || 0)) * 63;
  const left = Math.floor(position);
  const right = Math.min(63, left + 1);
  const mix = position - left;
  return bins[left] + (bins[right] - bins[left]) * mix;
}

export function eventMarkerGeometry(event, rows, width, height) {
  if (!event || !rows?.length) return null;
  const firstTime = Number(rows[0].receivedAt);
  const lastTime = Number(rows.at(-1).receivedAt);
  if (Number.isFinite(firstTime) && Number.isFinite(lastTime) && (event.endedAt < firstTime || event.endedAt > lastTime)) return null;
  let rowIndex = 0;
  let closest = Infinity;
  rows.forEach((row, index) => {
    const distance = Math.abs(Number(row.receivedAt) - Number(event.endedAt));
    if (Number.isFinite(distance) && distance < closest) { closest = distance; rowIndex = index; }
  });
  const row = rows[rowIndex];
  const startHz = row.centerHz - 32 * row.stepHz;
  const normalizedX = (event.frequencyHz - startHz) / (64 * row.stepHz);
  if (normalizedX < 0 || normalizedX > 1) return null;
  const x = normalizedX * width;
  const y = rows.length === 1 ? height / 2 : height - (rowIndex / (rows.length - 1)) * height;
  return { x, y, label: `${Math.round(event.peakDbm)} dBm` };
}

export function renderWaterfall(ctx, history, view = {}) {
  const width = ctx.canvas.clientWidth || ctx.canvas.width;
  const height = ctx.canvas.clientHeight || ctx.canvas.height;
  ctx.fillStyle = '#040711'; ctx.fillRect(0, 0, width, height);
  const rows = history.rows;
  if (!rows.length) return;
  const rowHeight = height / Math.max(rows.length, 1);
  rows.forEach((row, rowIndex) => {
    const y = height - (rowIndex + 1) * rowHeight;
    for (let x = 0; x < Math.ceil(width); x += 1) {
      const grain = (((row.sequence * 17 + x * 13) % 11) - 5) * .28;
      const value = sampleWaterfallBin(row.bins, x / Math.max(1, width - 1)) + grain;
      const [r, g, b] = paletteColor(value, view.floor ?? -120, view.ceiling ?? -40);
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(x, y, 1.2, Math.ceil(rowHeight + .35));
    }
  });
  if (Number.isInteger(view.selectedBin)) {
    const binWidth = width / 64;
    ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 1;
    ctx.strokeRect(view.selectedBin * binWidth + .5, .5, binWidth, height - 1);
  }
  (view.rfEvents ?? []).slice(0, 12).forEach((event) => {
    const marker = eventMarkerGeometry(event, rows, width, height);
    if (!marker) return;
    ctx.save();
    ctx.translate(marker.x, marker.y);
    ctx.fillStyle = '#ffb12c'; ctx.strokeStyle = '#1b0900'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, -5); ctx.lineTo(5, 0); ctx.lineTo(0, 5); ctx.lineTo(-5, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  });
}


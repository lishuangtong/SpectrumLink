import { normalizeDbm } from './history.js';
import { paletteColor } from './render-waterfall.js';

export function projectPoint(bin, depth, level, width, height, view = {}) {
  const perspective = view.perspective ?? 0.72;
  const scale = 1 / (1 + depth * 0.008 * perspective);
  const horizon = height * 0.16;
  const floorY = height * 0.9 - depth * height * 0.0048;
  const x = width * 0.5 + (bin - 31.5) * (width * 0.0128) * scale;
  const y = floorY - level * height * 0.56 * (view.verticalScale ?? 1) * scale;
  return { x, y: Math.max(horizon, y), scale };
}

export function spectrum3dOpacity(scale, current = false) {
  const base = .06 + Math.max(0, Math.min(1, Number(scale) || 0)) * .38;
  return Math.min(.78, base + (current ? .25 : 0));
}

export function renderSpectrum3D(ctx, history, view = {}) {
  const width = ctx.canvas.clientWidth || ctx.canvas.width;
  const height = ctx.canvas.clientHeight || ctx.canvas.height;
  const bg = ctx.createRadialGradient(width * .5, height * .7, 10, width * .5, height * .55, width * .75);
  bg.addColorStop(0, '#10203e'); bg.addColorStop(.48, '#071022'); bg.addColorStop(1, '#03050a');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, width, height);
  const rows = history.rows;
  if (!rows.length) return;
  ctx.strokeStyle = 'rgba(57,126,210,.18)'; ctx.lineWidth = 1;
  for (let d = 0; d <= 80; d += 10) {
    const a = projectPoint(0, d, 0, width, height, view); const b = projectPoint(63, d, 0, width, height, view);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  }
  const maxRows = Math.min(rows.length, 96);
  for (let rowIndex = 0; rowIndex < maxRows; rowIndex += 1) {
    const row = rows[rows.length - 1 - rowIndex];
    const depth = rowIndex * (80 / Math.max(maxRows - 1, 1));
    for (let bin = 0; bin < 63; bin += 1) {
      const valueA = normalizeDbm(row.bins[bin], view.floor ?? -120, view.ceiling ?? -40);
      const valueB = normalizeDbm(row.bins[bin + 1], view.floor ?? -120, view.ceiling ?? -40);
      const a = projectPoint(bin, depth, valueA, width, height, view);
      const b = projectPoint(bin + 1, depth, valueB, width, height, view);
      const [r, g, blue] = paletteColor(Math.max(row.bins[bin], row.bins[bin + 1]), view.floor ?? -120, view.ceiling ?? -40);
      ctx.strokeStyle = `rgba(${r},${g},${blue},${spectrum3dOpacity(a.scale, rowIndex === 0)})`;
      ctx.lineWidth = Math.max(.65, (rowIndex === 0 ? 1.8 : 1.3) * a.scale);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
  }
  if (Number.isInteger(view.selectedBin)) {
    const floor = projectPoint(view.selectedBin, 0, 0, width, height, view);
    const top = projectPoint(view.selectedBin, 0, 1, width, height, view);
    ctx.strokeStyle = '#ffe072'; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(floor.x, floor.y); ctx.lineTo(top.x, top.y); ctx.stroke();
  }
}


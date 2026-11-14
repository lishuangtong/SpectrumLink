import { normalizeDbm } from './history.js';

export function frequencyAtBin(sweep, bin) {
  return sweep.centerHz + (bin - 32) * sweep.stepHz;
}

export const axisFont = (width) => width < 360 ? '8px ui-monospace, monospace' : '11px ui-monospace, monospace';

export function frequencyAxisTicks(sweep, width) {
  const count = width < 460 ? 2 : width < 700 ? 5 : 9;
  return Array.from({ length: count }, (_, index) => {
    const bin = Math.round(index * 63 / (count - 1));
    return { bin, label: (frequencyAtBin(sweep, bin) / 1e6).toFixed(width < 460 ? 3 : 4) };
  });
}

export function peakMarkerGeometry(peak, { width, height, floor = -125, ceiling = -35, rank = 1 }) {
  const left = width < 460 ? 42 : 54;
  const right = width - 14;
  const top = 16;
  const bottom = height - 28;
  return {
    x: left + (peak.bin / 64) * (right - left),
    y: bottom - normalizeDbm(peak.dbm, floor, ceiling) * (bottom - top),
    label: `P${rank} ${(peak.frequencyHz / 1e6).toFixed(4)}`,
  };
}

export function renderSpectrum2D(ctx, history, view = {}) {
  const width = ctx.canvas.clientWidth || ctx.canvas.width;
  const height = ctx.canvas.clientHeight || ctx.canvas.height;
  ctx.clearRect(0, 0, width, height);
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, '#06090a'); gradient.addColorStop(1, '#000202');
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, width, height);
  const latest = history.latest;
  if (!latest) return;
  const floor = view.floor ?? -125;
  const ceiling = view.ceiling ?? -35;
  const left = width < 460 ? 42 : 54, right = width - 14, top = 16, bottom = height - 28;
  ctx.strokeStyle = 'rgba(142,158,164,.22)'; ctx.lineWidth = 1;
  ctx.fillStyle = '#8c9ca0'; ctx.font = axisFont(width);
  const firstDbmTick = Math.ceil(floor / 10) * 10;
  for (let tick = firstDbmTick; tick <= ceiling; tick += 10) {
    const y = bottom - normalizeDbm(tick, floor, ceiling) * (bottom - top);
    ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(right, y); ctx.stroke();
    ctx.fillText(`${tick}`, 5, y + 4);
  }
  const xFor = (index) => left + (index / 63) * (right - left);
  const yFor = (value) => bottom - normalizeDbm(value, floor, ceiling) * (bottom - top);
  const frequencyTicks = frequencyAxisTicks(latest, width);
  frequencyTicks.forEach(({ bin }) => {
    const x = xFor(bin);
    ctx.strokeStyle = 'rgba(142,158,164,.17)';
    ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, bottom); ctx.stroke();
  });
  const tunedBin = Number.isInteger(view.selectedBin) ? view.selectedBin : 32;
  const tunedX = xFor(tunedBin);
  const passbandWidth = Math.max(8, (right - left) / 32);
  ctx.fillStyle = 'rgba(190,198,202,.16)';
  ctx.fillRect(tunedX - passbandWidth / 2, top, passbandWidth, bottom - top);
  ctx.beginPath();
  latest.bins.forEach((value, index) => index ? ctx.lineTo(xFor(index), yFor(value)) : ctx.moveTo(xFor(index), yFor(value)));
  ctx.lineTo(right, bottom); ctx.lineTo(left, bottom); ctx.closePath();
  const fill = ctx.createLinearGradient(0, top, 0, bottom);
  fill.addColorStop(0, 'rgba(0,235,255,.34)'); fill.addColorStop(.52, 'rgba(0,154,170,.26)'); fill.addColorStop(1, 'rgba(0,42,48,.14)');
  ctx.fillStyle = fill; ctx.fill();
  ctx.beginPath();
  latest.bins.forEach((value, index) => index ? ctx.lineTo(xFor(index), yFor(value)) : ctx.moveTo(xFor(index), yFor(value)));
  ctx.strokeStyle = '#12d9ef'; ctx.lineWidth = 1.55; ctx.shadowColor = '#00bcd4'; ctx.shadowBlur = 5; ctx.stroke(); ctx.shadowBlur = 0;
  if (view.peakHold !== false) {
    ctx.beginPath();
    history.peakHold.forEach((value, index) => index ? ctx.lineTo(xFor(index), yFor(value)) : ctx.moveTo(xFor(index), yFor(value)));
    ctx.strokeStyle = 'rgba(255,200,80,.7)'; ctx.lineWidth = 1; ctx.setLineDash([4, 4]); ctx.stroke(); ctx.setLineDash([]);
  }
  const peakX = xFor(latest.peakIndex); const peakY = yFor(latest.bins[latest.peakIndex]);
  ctx.fillStyle = '#ffd33d'; ctx.beginPath(); ctx.arc(peakX, peakY, 2.6, 0, Math.PI * 2); ctx.fill();
  (view.peakMarkers ?? []).slice(0, 3).forEach((peak, index) => {
    const marker = peakMarkerGeometry(peak, { width, height, floor, ceiling, rank: index + 1 });
    ctx.strokeStyle = index ? 'rgba(255,202,61,.72)' : '#ff7b22';
    ctx.fillStyle = index ? '#ffe27d' : '#ffad2f';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(marker.x, marker.y - 4); ctx.lineTo(marker.x, Math.max(top + 13, marker.y - 17)); ctx.stroke();
    ctx.font = width < 460 ? '7px ui-monospace, monospace' : '8px ui-monospace, monospace';
    ctx.textAlign = marker.x > width * .72 ? 'right' : 'left';
    ctx.fillText(marker.label, marker.x + (marker.x > width * .72 ? -3 : 3), Math.max(top + 9, marker.y - 19));
  });
  ctx.strokeStyle = '#ff3028'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(tunedX, top); ctx.lineTo(tunedX, bottom); ctx.stroke();
  ctx.fillStyle = '#91a8bf';
  frequencyTicks.forEach(({ bin, label }, index) => {
    ctx.textAlign = index === 0 ? 'left' : index === frequencyTicks.length - 1 ? 'right' : 'center';
    ctx.fillText(label, xFor(bin), height - 8);
  });
  ctx.textAlign = 'right'; ctx.fillStyle = '#647880'; ctx.fillText('MHz', right, top + 10); ctx.textAlign = 'left';
}


const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
export const shouldRenderRadar = (timestamp, lastTimestamp) => lastTimestamp === null || timestamp - lastTimestamp > 80;
export const shouldLabelAircraft = (aircraft, selectedId) => aircraft.id === selectedId;

export function projectAircraft(aircraft, radiusKm, center, radarRadius) {
  const distance = clamp(aircraft.distanceKm / radiusKm, 0, 1) * radarRadius;
  const bearing = aircraft.bearingDeg * Math.PI / 180;
  return {
    x: Math.round((center.x + Math.sin(bearing) * distance) * 1e6) / 1e6,
    y: Math.round((center.y - Math.cos(bearing) * distance) * 1e6) / 1e6,
  };
}

export function radarGeometry(aircraft, { width, height, radiusKm }) {
  const radarRadius = Math.max(20, Math.min(width, height) * .43);
  const center = { x: width / 2, y: height / 2 };
  const targets = aircraft
    .filter((plane) => Number.isFinite(plane.distanceKm) && Number.isFinite(plane.bearingDeg) && plane.distanceKm <= radiusKm)
    .map((plane) => ({ aircraft: plane, ...projectAircraft(plane, radiusKm, center, radarRadius), hitRadius: 14 }));
  return { center, radarRadius, targets };
}

const WORLD_SHAPES = Object.freeze([
  [[-.83,-.34],[-.72,-.58],[-.45,-.65],[-.28,-.48],[-.34,-.2],[-.5,-.05],[-.43,.18],[-.58,.34],[-.76,.17]],
  [[-.39,.2],[-.23,.13],[-.12,.33],[-.2,.68],[-.35,.84],[-.44,.55]],
  [[-.1,-.6],[.12,-.7],[.33,-.58],[.28,-.42],[.06,-.36],[-.01,-.13],[-.16,-.2],[-.23,-.43]],
  [[.18,-.35],[.48,-.55],[.84,-.38],[.72,-.1],[.48,-.06],[.38,.14],[.14,.05],[.02,-.17]],
  [[.05,.08],[.28,.14],[.37,.46],[.17,.76],[-.03,.55],[-.09,.24]],
  [[.55,.42],[.79,.46],[.87,.68],[.65,.75],[.48,.61]],
]);

export function radarVisualLayers(width, height) {
  const radarRadius = Math.max(20, Math.min(width, height) * .43);
  const center = { x: width / 2, y: height / 2 };
  const rings = [1, 2, 3, 4].map((ring) => radarRadius * ring / 4);
  const bezelSegments = Array.from({ length: 20 }, (_, index) => ({
    start: index * Math.PI * 2 / 20 + .025,
    end: (index + 1) * Math.PI * 2 / 20 - .025,
    color: index % 2 === 0 ? '#ffd321' : '#3cdf38',
  }));
  const gridLines = [];
  const step = Math.max(12, radarRadius / 8);
  for (let offset = -radarRadius; offset <= radarRadius; offset += step) {
    gridLines.push({ x1: center.x - radarRadius, y1: center.y + offset, x2: center.x + radarRadius, y2: center.y + offset });
    gridLines.push({ x1: center.x + offset, y1: center.y - radarRadius, x2: center.x + offset, y2: center.y + radarRadius });
  }
  const landmasses = WORLD_SHAPES.map((points) => points.map(([x, y]) => ({ x: center.x + x * radarRadius, y: center.y + y * radarRadius })));
  return { center, radarRadius, rings, bezelSegments, gridLines, landmasses };
}

function polygon(ctx, points) {
  if (!points.length) return;
  ctx.beginPath(); ctx.moveTo(points[0].x, points[0].y);
  points.slice(1).forEach((point) => ctx.lineTo(point.x, point.y));
  ctx.closePath();
}

export function renderRadar(ctx, aircraft, options = {}) {
  const width = ctx.canvas.clientWidth || ctx.canvas.width;
  const height = ctx.canvas.clientHeight || ctx.canvas.height;
  const radiusKm = options.radiusKm ?? 120;
  const geometry = radarGeometry(aircraft, { width, height, radiusKm });
  const layers = radarVisualLayers(width, height);
  const { center, radarRadius } = layers;
  const gradient = ctx.createRadialGradient(center.x, center.y, 4, center.x, center.y, radarRadius);
  gradient.addColorStop(0, '#0b461d');
  gradient.addColorStop(.68, '#063315');
  gradient.addColorStop(1, '#001507');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.beginPath(); ctx.arc(center.x, center.y, radarRadius, 0, Math.PI * 2); ctx.clip();
  ctx.strokeStyle = 'rgba(62,170,75,.13)'; ctx.lineWidth = 1;
  layers.gridLines.forEach((line) => { ctx.beginPath(); ctx.moveTo(line.x1, line.y1); ctx.lineTo(line.x2, line.y2); ctx.stroke(); });
  ctx.fillStyle = 'rgba(49,130,54,.2)';
  layers.landmasses.forEach((points) => { polygon(ctx, points); ctx.fill(); });
  ctx.restore();

  ctx.strokeStyle = 'rgba(185,255,73,.36)';
  ctx.lineWidth = 1;
  layers.rings.forEach((radius) => { ctx.beginPath(); ctx.arc(center.x, center.y, radius, 0, Math.PI * 2); ctx.stroke(); });
  ctx.beginPath();
  ctx.moveTo(center.x - radarRadius, center.y);
  ctx.lineTo(center.x + radarRadius, center.y);
  ctx.moveTo(center.x, center.y - radarRadius);
  ctx.lineTo(center.x, center.y + radarRadius);
  ctx.stroke();

  ctx.font = '9px ui-monospace, monospace';
  ctx.fillStyle = 'rgba(160,255,193,.62)';
  ctx.textAlign = 'center';
  for (let ring = 1; ring <= 4; ring += 1) ctx.fillText(`${Math.round(radiusKm * ring / 4)} km`, center.x, center.y - radarRadius * ring / 4 + 11);

  ctx.lineWidth = Math.max(4, radarRadius * .035);
  layers.bezelSegments.forEach((segment) => { ctx.strokeStyle = segment.color; ctx.beginPath(); ctx.arc(center.x, center.y, radarRadius * 1.035, segment.start, segment.end); ctx.stroke(); });

  const sweep = ((options.time ?? performance.now()) / 4200 % 1) * Math.PI * 2;
  try {
    const sweepGradient = ctx.createConicGradient(sweep - .5, center.x, center.y);
    sweepGradient.addColorStop(0, 'rgba(61,255,50,0)'); sweepGradient.addColorStop(.07, 'rgba(61,255,50,.28)'); sweepGradient.addColorStop(.12, 'rgba(61,255,50,0)');
    ctx.fillStyle = sweepGradient; ctx.beginPath(); ctx.arc(center.x, center.y, radarRadius, 0, Math.PI * 2); ctx.fill();
  } catch {
    ctx.strokeStyle = 'rgba(93,255,147,.55)'; ctx.beginPath(); ctx.moveTo(center.x, center.y); ctx.lineTo(center.x + Math.cos(sweep) * radarRadius, center.y + Math.sin(sweep) * radarRadius); ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(74,255,48,.88)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(center.x, center.y); ctx.lineTo(center.x + Math.cos(sweep) * radarRadius, center.y + Math.sin(sweep) * radarRadius); ctx.stroke();

  geometry.targets.forEach((target) => {
    const selected = target.aircraft.id === options.selectedId;
    ctx.save();
    ctx.translate(target.x, target.y);
    ctx.rotate(((target.aircraft.headingDeg ?? target.aircraft.bearingDeg) * Math.PI / 180));
    ctx.fillStyle = selected ? '#ffd65a' : '#79ffad';
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = selected ? 14 : 7;
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(4.5, 6);
    ctx.lineTo(0, 3.5);
    ctx.lineTo(-4.5, 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.shadowBlur = 0;
    if (selected) {
      ctx.strokeStyle = '#ffd321'; ctx.lineWidth = 1.5; ctx.strokeRect(target.x - 10, target.y - 10, 20, 20);
    }
    if (shouldLabelAircraft(target.aircraft, options.selectedId)) {
      ctx.textAlign = 'left'; ctx.font = '9px ui-monospace, monospace'; ctx.fillStyle = '#ffe58c'; ctx.fillText(target.aircraft.callsign, target.x + 7, target.y - 7);
    }
  });
  ctx.textAlign = 'left';
  return geometry.targets;
}


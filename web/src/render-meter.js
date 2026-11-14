const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function dbmToMeter(dbm) {
  const numeric = Number(dbm);
  const value = clamp(Number.isFinite(numeric) ? numeric : -141, -141, -20);
  // IARU VHF/UHF convention: S9 = -93 dBm and one S-unit = 6 dB.
  const s = clamp(Math.round((Math.min(value, -93) + 147) / 6), 1, 9);
  const over = value > -93 ? Math.min(70, Math.round((value + 93) / 10) * 10) : 0;
  const ratio = value <= -93 ? ((value + 141) / 48) * .72 : .72 + ((value + 93) / 73) * .28;
  return { s, over, label: over ? `S9+${over}` : `S${s}`, ratio };
}

export function meterNeedleAngle(dbm) {
  return -55 + dbmToMeter(dbm).ratio * 110;
}

export function meterFrame(width, height) {
  return { x: 8, y: 8, width: Math.max(0, width - 16), height: Math.max(0, height - 16) };
}

export function digitalMeterTextY(height) {
  return {
    label: Math.max(18, height - 26),
    dbm: Math.max(18, height - 28),
  };
}

export function digitalMeterLayout(height) {
  const text = digitalMeterTextY(height);
  return { labelY: text.label, dbmY: text.dbm, barY: Math.max(16, Math.min(26, height - 12)) };
}

export function nextMeterState(state, dbm) {
  const numeric = Number(dbm);
  const raw = clamp(Number.isFinite(numeric) ? numeric : -141, -141, -20);
  if (!state) return { displayDbm: raw };
  const previous = Number.isFinite(state.displayDbm) ? state.displayDbm : raw;
  const response = raw > previous ? .28 : .12;
  return { displayDbm: previous + (raw - previous) * response };
}

export function renderAnalogMeter(ctx, dbm = -121) {
  const width = ctx.canvas.clientWidth || ctx.canvas.width;
  const height = ctx.canvas.clientHeight || ctx.canvas.height;
  const frame = meterFrame(width, height);
  const cx = width / 2;
  const cy = height * .88;
  const radius = Math.min(width * .41, height * .72);
  const face = ctx.createLinearGradient(0, frame.y, 0, frame.y + frame.height);
  face.addColorStop(0, '#ffb43d'); face.addColorStop(.52, '#e78519'); face.addColorStop(1, '#a84b0f');
  ctx.fillStyle = '#050403'; ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#1c1108'; ctx.fillRect(frame.x, frame.y, frame.width, frame.height);
  ctx.fillStyle = face; ctx.fillRect(frame.x + 4, frame.y + 4, frame.width - 8, frame.height - 8);
  ctx.strokeStyle = '#a85b14'; ctx.lineWidth = 2; ctx.strokeRect(frame.x + 1, frame.y + 1, frame.width - 2, frame.height - 2);
  ctx.strokeStyle = 'rgba(255,238,175,.42)'; ctx.lineWidth = 1; ctx.font = '700 9px ui-monospace, monospace'; ctx.textAlign = 'center'; ctx.fillStyle = '#2a1305';
  for (let index = 0; index <= 10; index += 1) {
    const angle = (-55 + index * 11) * Math.PI / 180 - Math.PI / 2;
    const inner = radius * (index % 2 ? .81 : .76); const outer = radius * .92;
    ctx.beginPath(); ctx.moveTo(cx + Math.cos(angle) * inner, cy + Math.sin(angle) * inner); ctx.lineTo(cx + Math.cos(angle) * outer, cy + Math.sin(angle) * outer); ctx.stroke();
    if (index % 2 === 0) ctx.fillText(index < 9 ? `${index + 1}` : `+${(index - 8) * 10}`, cx + Math.cos(angle) * radius * .64, cy + Math.sin(angle) * radius * .64 + 3);
  }
  ctx.font = '800 14px ui-monospace, monospace'; ctx.fillText('SIGNAL', cx, frame.y + frame.height * .67);
  ctx.font = '700 9px ui-monospace, monospace'; ctx.fillText('dBm / S-UNIT', cx, frame.y + frame.height * .77);
  const needle = meterNeedleAngle(dbm) * Math.PI / 180 - Math.PI / 2;
  ctx.strokeStyle = '#2c0802'; ctx.shadowColor = '#ff3f16'; ctx.shadowBlur = 8; ctx.lineWidth = 2.4;
  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(needle) * radius * .88, cy + Math.sin(needle) * radius * .88); ctx.stroke(); ctx.shadowBlur = 0;
  ctx.fillStyle = '#1b120c'; ctx.beginPath(); ctx.arc(cx, cy, 8, 0, Math.PI * 2); ctx.fill();
}

export function renderDigitalMeter(ctx, dbm = -121, displayDbm = dbm) {
  const width = ctx.canvas.clientWidth || ctx.canvas.width;
  const height = ctx.canvas.clientHeight || ctx.canvas.height;
  const meter = dbmToMeter(displayDbm);
  const reading = meter;
  const layout = digitalMeterLayout(height);
  ctx.fillStyle = '#030605'; ctx.fillRect(0, 0, width, height);
  const count = 24; const lit = Math.round(meter.ratio * count); const gap = 3; const barWidth = (width - 24 - gap * (count - 1)) / count;
  for (let index = 0; index < count; index += 1) {
    const x = 12 + index * (barWidth + gap); const hot = index >= 20;
    ctx.fillStyle = index < lit ? (hot ? '#ff5a37' : '#55ff84') : (hot ? '#32100d' : '#0e2a18');
    ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = index < lit ? 7 : 0; ctx.fillRect(x, layout.barY, barWidth, 12);
  }
  ctx.shadowBlur = 0; ctx.fillStyle = '#d8ffe2'; ctx.font = '800 19px ui-monospace, monospace'; ctx.textAlign = 'left'; ctx.fillText(reading.label, 12, layout.labelY);
  ctx.fillStyle = '#74ff9c'; ctx.font = '600 12px ui-monospace, monospace'; ctx.textAlign = 'right'; ctx.fillText(`${Math.round(displayDbm)} dBm`, width - 12, layout.dbmY); ctx.textAlign = 'left';
}

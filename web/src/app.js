import { buildAircraftDetail, normalizeAircraft } from './aircraft.js';
import { buildAirspaceSummary, createLatestRequestGuard, formatAirspaceSummary } from './airspace-summary.js';
import { AIRCRAFT_CAROUSEL_INTERVAL_MS, aircraftModelProfile, createAircraftTransitionController, essentialAircraftFacts, nextAircraftId, shouldAdvanceAircraftCarousel } from './aircraft-carousel.js';
import { Aircraft3DViewer, modelCreditText } from './aircraft-3d.js';
import { aircraftModelAsset } from './aircraft-model-assets.js';
import { SpectrumHistory } from './history.js';
import { SUPPORTED_LOCALES, applyDocumentTranslations, createI18n } from './i18n.js';
import { clampDragPosition, clearModuleLayout, loadModuleLayout, normalizePosition, saveModuleLayout } from './layout.js';
import { loadPreferences, savePreferences } from './preferences.js';
import { appendRfEvent, formatRfEvent, loadRfEvents, renderRfEvents, saveRfEvents } from './rf-events.js';
import { canStartModuleDrag, createModuleFocusController, createPanelFocusController } from './module-focus.js';
import { decodeHello, decodeStatus, decodeSweep, MESSAGE } from './protocol.js';
import { loadRecentContacts, renderRecentContacts, saveRecentContacts, upsertRecentContact } from './recent-contacts.js';
import { renderSpectrum2D, frequencyAtBin } from './render-2d.js';
import { renderSpectrum3D } from './render-3d.js';
import { dbmToMeter, nextMeterState, renderAnalogMeter, renderDigitalMeter } from './render-meter.js';
import { renderRadar, shouldRenderRadar } from './render-radar.js';
import { eventMarkerGeometry, renderWaterfall, sdrDisplayRange } from './render-waterfall.js';
import { SerialLink } from './serial-link.js';
import { createSignalActivityDetector } from './signal-activity.js';
import { SweepSimulator } from './simulator.js';
import { createTerrainMap } from './terrain-map.js';
import * as maplibregl from '../vendor/maplibre/maplibre-gl.js';

const $ = (id) => document.getElementById(id);
const spectrumCanvases = ['spectrum3d', 'spectrum2d', 'waterfall'].map($);
const spectrumContexts = spectrumCanvases.map((canvas) => canvas.getContext('2d'));
const analogContext = $('analogMeter').getContext('2d');
const digitalContext = $('digitalMeter').getContext('2d');
const radarContext = $('radarCanvas').getContext('2d');
const insetRadarContext = $('aircraftInsetRadar').getContext('2d');
const allCanvases = [...spectrumCanvases, $('analogMeter'), $('digitalMeter'), $('radarCanvas'), $('aircraftInsetRadar')];
const allContexts = [...spectrumContexts, analogContext, digitalContext, radarContext, insetRadarContext];
const history = new SpectrumHistory({ depth: 192 });
const serial = new SerialLink();
const simulator = new SweepSimulator();
const transitions = [];
const sweepSummaries = [];
let source = 'idle';
let selectedBin = null;
let selectedHz = null;
let paused = false;
let dirty = true;
let lastSweepAt = 0;
let sweepRate = 0;
let digitalMeterState = null;
let digitalMeterDbm = -121;
let radioIdentity = null;
let radioStatus = null;
let preferences = loadPreferences();
let signalDetector = createSignalActivityDetector({ thresholdDb: preferences.signalThresholdDb, releaseMs: 500 });
let signalActivity = { active: false, peaks: [], durationMs: 0, completedEvent: null };
let rfEventRows = loadRfEvents(localStorage);
let activeLogTab = 'qso';
const i18n = createI18n(preferences.locale);
let lastUiState = 'disconnected';
let pendingAvatar = preferences.avatar;
let aircraft = [];
let selectedAircraftId = null;
let radarHits = [];
let radarMode = 'loading';
let aircraftRefreshMeta = { status: 'loading', latencyMs: null, updatedAt: null };
let lastRadarRender = null;
let carouselPausedUntil = 0;
const dashboardCanvas = $('dashboardCanvas');
const dashboardModules = [...dashboardCanvas.querySelectorAll('[data-module]')];
let recentContactRows = loadRecentContacts(localStorage, [
  { callsign: 'BD3SAI', qth: '太原 · 小店', date: '2026-11-07', time: '00:42' },
  { callsign: 'BH3RFX', qth: '晋中 · 榆次', date: '2026-11-06', time: '22:39' },
  { callsign: 'BG3UPT', qth: '忻州', date: '2026-11-06', time: '21:35' },
  { callsign: 'BG3TAM', qth: '吕梁', date: '2026-11-05', time: '20:31' },
  { callsign: 'BI3NJK', qth: '太原 · 杏花岭', date: '2026-11-05', time: '19:28' },
]);
let moduleLayout = loadModuleLayout();
let highestModuleZ = 10;
let aircraft3dViewer = null;
let aircraftModelLoading = false;
let aircraftModelRequestVersion = 0;
let terrainMap = null;
let currentTerrainShot = 'fly-by';
const aircraftTransitionController = createAircraftTransitionController({
  stage: $('aircraftShowcase'),
  duration: matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : undefined,
});
const aircraftRefreshGuard = createLatestRequestGuard();

for (const { code, label } of SUPPORTED_LOCALES) {
  const option = document.createElement('option');
  option.value = code; option.textContent = label; option.lang = code;
  $('languageInput').append(option);
}

const stateKeys = { selecting: 'connection.selecting', connecting: 'connection.waiting', ready: 'connection.ready', demo: 'connection.demo', disconnected: 'connection.disconnected', idle: 'connection.disconnected', error: 'connection.error' };
const t = (key, variables) => i18n.t(key, variables);

function syncLocalizedRuntimeText() {
  $('stateText').textContent = t(stateKeys[lastUiState] || 'connection.disconnected');
  $('pauseBtn').textContent = t(paused ? 'scan.resume' : 'scan.pause');
  if (selectedHz === null) $('selectedFrequency').textContent = t('scan.none');
  if (radarMode === 'live') $('radarSource').textContent = t('radar.liveCount', { count: aircraft.length });
  else if (radarMode === 'error') $('radarSource').textContent = t('radar.unavailable');
  else $('radarSource').textContent = t('radar.preparing');
  updateSignalActivityReadout(); renderContactLog(); renderAircraftInfo();
}

function applyLanguage(locale) {
  i18n.setLocale(locale);
  applyDocumentTranslations(document, i18n);
  document.title = t('app.title');
  $('languageInput').value = i18n.locale;
  syncLocalizedRuntimeText();
}

try {
  aircraft3dViewer = new Aircraft3DViewer($('aircraftModel3d'));
} catch (error) {
  console.warn('WebGL aircraft viewer unavailable', error);
  $('aircraftShowcase').classList.add('webgl-fallback');
}

const view = { floor: -122, ceiling: -42, verticalScale: 1, perspective: .72, peakHold: true, selectedBin: null, peakMarkers: [], rfEvents: rfEventRows };
const liveControls = [$('pauseBtn'), $('centerDown'), $('centerUp'), $('monitorBtn'), ...$('spanButtons').querySelectorAll('button')];

function selectedFlightPosition() {
  const selected = aircraft.find((plane) => plane.id === selectedAircraftId);
  return selected ? { longitude: selected.longitude, latitude: selected.latitude, heading: selected.headingDeg } : null;
}

function ensureTerrainMap() {
  if (terrainMap) return terrainMap;
  terrainMap = createTerrainMap({
    maplibregl,
    container: $('aircraftTerrainMap'),
    longitude: preferences.longitude,
    latitude: preferences.latitude,
    onUnavailable: () => {
      $('aircraftModelStage').dataset.terrainMode = 'local3d';
      aircraft3dViewer?.setTerrainMode('local3d');
      $('pendingText').textContent = '真实地形网络不可用，已切换本地 3D 后备';
    },
  });
  terrainMap?.setMode(preferences.terrainMode);
  terrainMap?.setFlight(selectedFlightPosition());
  terrainMap?.setPresentation(currentTerrainShot);
  return terrainMap;
}

function applyTerrainMode() {
  const mode = preferences.terrainMode;
  $('aircraftModelStage').dataset.terrainMode = mode;
  aircraft3dViewer?.setTerrainMode(mode);
  if (mode === 'local3d') terrainMap?.setVisible(false);
  else {
    const map = ensureTerrainMap();
    map?.setVisible(true);
    map?.setMode(mode);
    map?.setFlight(selectedFlightPosition());
  }
}

function applyPreferences() {
  $('languageInput').value = preferences.locale;
  $('nicknameReadout').textContent = preferences.nickname;
  $('primaryCallsign').textContent = preferences.callsignPrimary;
  $('secondaryCallsign').textContent = preferences.callsignSecondary;
  $('secondaryCallsign').hidden = !preferences.callsignSecondary;
  $('locationReadout').textContent = preferences.location;
  $('sloganReadout').textContent = preferences.bio;
  document.documentElement.style.setProperty('--callsign-color', preferences.callsignColor);
  document.documentElement.style.setProperty('--callsign-size', `${preferences.callsignSize}px`);
  document.documentElement.style.setProperty('--location-color', preferences.locationColor);
  document.documentElement.style.setProperty('--location-size', `${preferences.locationSize}px`);
  $('avatarFallback').textContent = preferences.callsignPrimary.replace(/[^A-Z0-9]/g, '').slice(0, 2) || 'SL';
  $('avatarImage').src = preferences.avatar || '';
  $('avatarImage').classList.toggle('has-avatar', Boolean(preferences.avatar));
  $('nicknameInput').value = preferences.nickname;
  $('callsignPrimaryInput').value = preferences.callsignPrimary;
  $('callsignSecondaryInput').value = preferences.callsignSecondary;
  $('locationInput').value = preferences.location;
  $('bioInput').value = preferences.bio;
  $('callsignColorInput').value = preferences.callsignColor;
  $('callsignSizeInput').value = preferences.callsignSize;
  $('locationColorInput').value = preferences.locationColor;
  $('locationSizeInput').value = preferences.locationSize;
  $('latitudeInput').value = preferences.latitude;
  $('longitudeInput').value = preferences.longitude;
  $('radarRadiusInput').value = preferences.radarRadiusNm;
  $('terrainModeInput').value = preferences.terrainMode;
  $('signalThresholdInput').value = preferences.signalThresholdDb;
  $('signalThresholdOut').value = `${preferences.signalThresholdDb} dB`;
  terrainMap?.setCenter(preferences.longitude, preferences.latitude);
  applyTerrainMode();
}

function applyModuleLayout() {
  const bounds = { width: dashboardCanvas.clientWidth, height: dashboardCanvas.clientHeight };
  dashboardModules.forEach((module) => {
    const saved = moduleLayout[module.dataset.module];
    if (!saved) return;
    const size = { width: module.offsetWidth, height: module.offsetHeight };
    module.style.left = `${saved.x * Math.max(0, bounds.width - size.width)}px`;
    module.style.top = `${saved.y * Math.max(0, bounds.height - size.height)}px`;
  });
}

function installModuleDragging() {
  dashboardModules.forEach((module) => {
    const handle = module.querySelector(':scope > .module-title');
    let drag = null;
    handle.addEventListener('pointerdown', (event) => {
      if (!canStartModuleDrag(module, dashboardCanvas, event)) return;
      const canvasRect = dashboardCanvas.getBoundingClientRect(); const moduleRect = module.getBoundingClientRect();
      drag = { pointerId: event.pointerId, offsetX: event.clientX - moduleRect.left, offsetY: event.clientY - moduleRect.top, canvasRect };
      module.style.left = `${moduleRect.left - canvasRect.left}px`; module.style.top = `${moduleRect.top - canvasRect.top}px`; module.style.zIndex = String(++highestModuleZ); module.classList.add('dragging'); handle.setPointerCapture(event.pointerId); event.preventDefault();
    });
    handle.addEventListener('pointermove', (event) => {
      if (!drag || event.pointerId !== drag.pointerId) return;
      const bounds = { width: dashboardCanvas.clientWidth, height: dashboardCanvas.clientHeight }; const size = { width: module.offsetWidth, height: module.offsetHeight };
      const position = clampDragPosition(event.clientX - drag.canvasRect.left - drag.offsetX, event.clientY - drag.canvasRect.top - drag.offsetY, bounds, size);
      module.style.left = `${position.x}px`; module.style.top = `${position.y}px`;
    });
    const finish = (event) => {
      if (!drag || event.pointerId !== drag.pointerId) return;
      const bounds = { width: dashboardCanvas.clientWidth, height: dashboardCanvas.clientHeight }; const size = { width: module.offsetWidth, height: module.offsetHeight };
      moduleLayout[module.dataset.module] = normalizePosition({ x: module.offsetLeft, y: module.offsetTop }, bounds, size); moduleLayout = saveModuleLayout(localStorage, moduleLayout); module.classList.remove('dragging'); drag = null; dirty = true;
    };
    handle.addEventListener('pointerup', finish); handle.addEventListener('pointercancel', finish);
  });
}

function setState(state, label) {
  lastUiState = state;
  transitions.push({ time: new Date().toISOString(), state });
  transitions.splice(0, Math.max(0, transitions.length - 40));
  $('stateText').textContent = label ?? t(stateKeys[state] || 'connection.disconnected');
  $('stateDot').classList.toggle('live', state === 'ready' || state === 'demo');
  const active = state === 'ready' || state === 'demo';
  liveControls.forEach((control) => { control.disabled = !active; });
  $('monitorBtn').disabled = state !== 'ready' || selectedHz === null;
  $('stopMonitorBtn').disabled = state !== 'ready';
  $('disconnectBtn').disabled = !active && state !== 'connecting';
  $('connectBtn').disabled = active || state === 'connecting';
  $('demoBtn').disabled = active || state === 'connecting';
}

function resetSignalActivity() {
  signalDetector = createSignalActivityDetector({ thresholdDb: preferences.signalThresholdDb, releaseMs: 500 });
  signalActivity = { active: false, peaks: [], durationMs: 0, completedEvent: null };
  view.peakMarkers = [];
  updateSignalActivityReadout();
}

function updateSignalActivityReadout() {
  const activity = $('rxActivity');
  activity.classList.toggle('active', Boolean(signalActivity.active));
  if (!signalActivity.active) {
    $('rxActivityFrequency').textContent = t('rf.waiting');
    $('rxActivityDuration').textContent = '0.0 s';
    return;
  }
  const meter = dbmToMeter(signalActivity.peakDbm);
  $('rxActivityFrequency').textContent = `${(signalActivity.frequencyHz / 1e6).toFixed(4)} · ${meter.label}`;
  $('rxActivityDuration').textContent = `${(signalActivity.durationMs / 1000).toFixed(1)} s`;
}

function updateSweep(sweep) {
  if (source === 'demo' && paused) return;
  const now = performance.now();
  if (lastSweepAt) sweepRate = sweepRate * .8 + (1000 / Math.max(1, now - lastSweepAt)) * .2;
  lastSweepAt = now;
  sweep.receivedAt = Date.now();
  const resetMeter = !history.latest;
  history.append(sweep);
  const peakDbm = sweep.bins[sweep.peakIndex];
  digitalMeterState = nextMeterState(resetMeter ? null : digitalMeterState, peakDbm);
  digitalMeterDbm = digitalMeterState.displayDbm;
  signalActivity = signalDetector.update(sweep, sweep.receivedAt);
  view.peakMarkers = signalActivity.peaks;
  if (signalActivity.completedEvent) {
    rfEventRows = appendRfEvent(rfEventRows, signalActivity.completedEvent);
    rfEventRows = saveRfEvents(localStorage, rfEventRows);
    view.rfEvents = rfEventRows;
    if (activeLogTab === 'rf') renderContactLog();
  }
  updateSignalActivityReadout();
  sweepSummaries.push({ sequence: sweep.sequence, centerHz: sweep.centerHz, stepHz: sweep.stepHz, peakIndex: sweep.peakIndex, peakDbm });
  if (sweepSummaries.length > 32) sweepSummaries.shift();
  $('centerReadout').innerHTML = `${(sweep.centerHz / 1e6).toFixed(4)} <em>MHz</em>`;
  $('spanReadout').textContent = `${sweep.stepHz * 64 / 1000} kHz`;
  $('peakReadout').innerHTML = `${sweep.bins[sweep.peakIndex]} <em>dBm</em>`;
  $('rateReadout').textContent = `${sweepRate.toFixed(1)}/s`;
  $('centerInput').value = (sweep.centerHz / 1e6).toFixed(4);
  $('spanButtons').querySelectorAll('button').forEach((button) => button.classList.toggle('active', Number(button.dataset.span) === sweep.stepHz * 64));
  dirty = true;
}

serial.onState = (state) => setState(state);
serial.onError = (error) => { $('pendingText').textContent = error.message; };
serial.onFrame = (frame) => {
  if (frame.type === MESSAGE.HELLO) radioIdentity = decodeHello(frame);
  else if (frame.type === MESSAGE.SWEEP) { updateSweep(decodeSweep(frame)); $('pendingText').textContent = '实时数据'; }
  else if (frame.type === MESSAGE.STATUS) radioStatus = decodeStatus(frame);
};

$('connectBtn').addEventListener('click', async () => {
  simulator.stop(); source = 'live'; history.clear(); resetSignalActivity();
  try { await serial.connect(); } catch (error) { source = 'idle'; setState('idle', error.name === 'NotFoundError' ? '已取消' : '连接失败'); }
});
$('demoBtn').addEventListener('click', () => {
  source = 'demo'; history.clear(); resetSignalActivity(); paused = false; setState('demo'); simulator.start(updateSweep); $('pendingText').textContent = t('connection.demo');
});
$('disconnectBtn').addEventListener('click', async () => {
  simulator.stop(); if (source === 'live') await serial.disconnect(); source = 'idle'; resetSignalActivity(); setState('idle');
});
$('pauseBtn').addEventListener('click', async () => {
  paused = !paused; $('pauseBtn').textContent = t(paused ? 'scan.resume' : 'scan.pause');
  if (source === 'live') await serial.send(paused ? MESSAGE.PAUSE : MESSAGE.RESUME);
  $('pendingText').textContent = paused ? '已暂停' : source === 'demo' ? '模拟信号' : '实时数据';
});
$('clearBtn').addEventListener('click', () => { history.clear(); resetSignalActivity(); dirty = true; });

function sendCenter(hz) {
  if (!Number.isFinite(hz) || hz <= 0) return;
  if (source === 'demo') simulator.setCenter(Math.round(hz));
  else if (source === 'live') { const payload = new Uint8Array(4); new DataView(payload.buffer).setUint32(0, Math.round(hz / 10), true); void serial.send(MESSAGE.SET_CENTER, payload); $('pendingText').textContent = '等待中心频率确认…'; }
}
$('centerInput').addEventListener('change', () => sendCenter(Number($('centerInput').value) * 1e6));
$('centerDown').addEventListener('click', () => sendCenter((history.latest?.centerHz ?? 145_500_000) - (history.latest?.stepHz ?? 6_250)));
$('centerUp').addEventListener('click', () => sendCenter((history.latest?.centerHz ?? 145_500_000) + (history.latest?.stepHz ?? 6_250)));
$('spanButtons').addEventListener('click', (event) => {
  const span = Number(event.target.dataset.span); if (!span) return;
  if (source === 'demo') simulator.setSpan(span);
  else if (source === 'live') { void serial.send(MESSAGE.SET_SPAN, Uint8Array.of([400_000, 800_000, 1_600_000, 3_200_000].indexOf(span))); $('pendingText').textContent = '等待跨度确认…'; }
});

$('depthInput').addEventListener('input', () => { const depth = Number($('depthInput').value); history.setDepth(depth); $('depthOut').value = depth; dirty = true; });
$('gainInput').addEventListener('input', () => { const gain = Number($('gainInput').value) / 100; $('gainOut').value = `${gain.toFixed(1)}×`; view.floor = -128 + (1 - gain) * 18; dirty = true; });
$('verticalInput').addEventListener('input', () => { view.verticalScale = Number($('verticalInput').value) / 100; $('verticalOut').value = `${view.verticalScale.toFixed(1)}×`; dirty = true; });
$('peakHold').addEventListener('change', () => { view.peakHold = $('peakHold').checked; dirty = true; });
$('signalThresholdInput').addEventListener('input', () => { $('signalThresholdOut').value = `${$('signalThresholdInput').value} dB`; });

$('waterfall').addEventListener('pointermove', (event) => {
  if (!history.latest) return;
  const rect = event.currentTarget.getBoundingClientRect(); const bin = Math.max(0, Math.min(63, Math.floor((event.clientX - rect.left) / rect.width * 64)));
  const x = event.clientX - rect.left; const y = event.clientY - rect.top;
  const nearbyEvent = rfEventRows.find((item) => {
    const marker = eventMarkerGeometry(item, history.rows, rect.width, rect.height);
    return marker && Math.hypot(marker.x - x, marker.y - y) < 14;
  });
  if (nearbyEvent) {
    const item = formatRfEvent(nearbyEvent, i18n.locale);
    $('cursorReadout').textContent = `${item.dateTime} · ${item.frequency} · ${item.peak} · ${item.duration}`;
  } else $('cursorReadout').textContent = `${(frequencyAtBin(history.latest, bin) / 1e6).toFixed(5)} MHz · BIN ${bin}`;
});
$('waterfall').addEventListener('click', (event) => {
  if (!history.latest) return;
  const rect = event.currentTarget.getBoundingClientRect(); selectedBin = Math.max(0, Math.min(63, Math.floor((event.clientX - rect.left) / rect.width * 64)));
  selectedHz = frequencyAtBin(history.latest, selectedBin); view.selectedBin = selectedBin; $('selectedFrequency').textContent = `${(selectedHz / 1e6).toFixed(5)} MHz`; $('monitorBtn').disabled = source !== 'live'; dirty = true;
});
$('monitorBtn').addEventListener('click', () => { if (!selectedHz || source !== 'live') return; const payload = new Uint8Array(4); new DataView(payload.buffer).setUint32(0, Math.round(selectedHz / 10), true); void serial.send(MESSAGE.MONITOR, payload); $('stopMonitorBtn').disabled = false; $('pendingText').textContent = '正在监听'; });
$('stopMonitorBtn').addEventListener('click', () => { void serial.send(MESSAGE.STOP_MONITOR); $('stopMonitorBtn').disabled = true; $('pendingText').textContent = '实时数据'; });

function selectAircraft(plane, manual = false) {
  const nextId = plane?.id ?? null;
  if (manual) carouselPausedUntil = Date.now() + AIRCRAFT_CAROUSEL_INTERVAL_MS;
  const commit = () => {
    selectedAircraftId = nextId;
    renderAircraftInfo();
    dirty = true;
  };
  if (!selectedAircraftId || selectedAircraftId === nextId) commit();
  else aircraftTransitionController.transition(commit);
}

function renderAircraftInfo() {
  if (!aircraft.some((plane) => plane.id === selectedAircraftId)) selectedAircraftId = aircraft[0]?.id ?? null;
  const selected = aircraft.find((plane) => plane.id === selectedAircraftId);
  $('showcaseCallsign').textContent = selected?.callsign ?? '当前无目标';
  const model = aircraftModelProfile(selected?.type);
  const modelAsset = aircraftModelAsset(selected?.type);
  $('showcaseType').textContent = selected ? [model.name, selected.registration].filter(Boolean).join(' · ') : (radarMode === 'error' ? '数据连接中断' : '太原中心 · 等待实时信号');
  $('aircraftMoreBtn').disabled = !selected;
  const facts = $('showcaseFacts'); facts.replaceChildren();
  if (selected) essentialAircraftFacts(selected).slice(0, 6).forEach(([label, value]) => {
    const item = document.createElement('div'); const caption = document.createElement('span'); const content = document.createElement('b');
    caption.textContent = label; content.textContent = value; item.append(caption, content); facts.append(item);
  });
  const requestVersion = ++aircraftModelRequestVersion;
  aircraftModelLoading = Boolean(aircraft3dViewer && selected);
  $('activeModelCredit').textContent = modelCreditText(modelAsset, modelAsset && aircraftModelLoading ? 'loading' : 'procedural');
  aircraft3dViewer?.startShotCycle();
  void Promise.resolve(aircraft3dViewer?.setAircraft(model, selected?.type)).then((loadedProvider) => {
    if (requestVersion !== aircraftModelRequestVersion) return;
    aircraftModelLoading = false;
    $('activeModelCredit').textContent = modelCreditText(modelAsset, loadedProvider || 'procedural');
  });
  aircraft3dViewer?.setTelemetry(selected || {});
  if (preferences.terrainMode !== 'local3d') ensureTerrainMap()?.setFlight(selected ? { longitude: selected.longitude, latitude: selected.latitude, heading: selected.headingDeg } : null);
  $('aircraftShowcase').classList.toggle('empty', !selected);
  $('carouselProgress').classList.remove('running'); void $('carouselProgress').offsetWidth; if (selected) $('carouselProgress').classList.add('running');
  const carousel = $('aircraftCarousel'); carousel.replaceChildren();
  aircraft.slice(0, 20).forEach((plane) => {
    const button = document.createElement('button'); button.type = 'button'; button.className = `aircraft-carousel-item${plane.id === selectedAircraftId ? ' active' : ''}`;
    const name = document.createElement('b'); name.textContent = plane.callsign;
    const meta = document.createElement('span'); meta.textContent = `${Math.round(plane.distanceKm)} km · ${Math.round(plane.bearingDeg)}°`;
    button.append(name, meta); button.addEventListener('click', () => selectAircraft(plane, true)); carousel.append(button);
    if (plane.id === selectedAircraftId) requestAnimationFrame(() => button.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' }));
  });
  renderAirspaceSummary();
}

function renderAirspaceSummary() {
  const summary = buildAirspaceSummary(aircraft, aircraftRefreshMeta);
  const text = formatAirspaceSummary(summary, { t, locale: i18n.locale });
  $('airspaceSummary').dataset.status = summary.status;
  $('airspaceCount').textContent = text.count;
  $('airspaceNearest').textContent = text.nearest;
  $('airspaceHighest').textContent = text.highest;
  $('airspaceLatency').textContent = text.latency;
  $('airspaceUpdated').textContent = text.updated;
}

const detailFields = [
  ['呼号', 'callsign'], ['ICAO 地址', 'icao'], ['注册号', 'registration'], ['机型', 'aircraftModel'], ['ICAO 机型', 'icaoType'], ['制造商', 'manufacturer'],
  ['运营方', 'owner'], ['航空公司', 'airline'], ['航线', 'route', true], ['起飞机场', 'originName', true], ['到达机场', 'destinationName', true],
  ['高度', 'altitudeFt', false, ' ft'], ['地速', 'speedKt', false, ' kt'], ['航向', 'headingDeg', false, '°'], ['垂直速率', 'verticalRateFpm', false, ' ft/min'],
  ['应答机', 'squawk'], ['距离', 'distanceKm', false, ' km'], ['方位', 'bearingDeg', false, '°'], ['坐标', 'coordinates', true],
];

function renderAircraftDetail(detail) {
  $('aircraftModalTitle').textContent = detail.callsign || detail.icao || '航班详情';
  const grid = $('aircraftDetailGrid'); grid.replaceChildren();
  detailFields.forEach(([label, key, wide, suffix = '']) => {
    let value = key === 'coordinates'
      ? (detail.latitude == null || detail.longitude == null ? null : `${detail.latitude.toFixed(5)}, ${detail.longitude.toFixed(5)}`)
      : detail[key];
    if (typeof value === 'number') value = `${Math.round(value)}${suffix}`;
    const card = document.createElement('div'); card.className = `aircraft-detail-card${wide ? ' wide' : ''}`;
    const caption = document.createElement('span'); caption.textContent = label;
    if (value === null || value === undefined || value === '') return;
    const content = document.createElement('b'); content.textContent = value;
    card.append(caption, content); grid.append(card);
  });
}

function setAircraftModal(open) {
  $('aircraftModal').setAttribute('aria-hidden', String(!open));
  $('aircraftModalBackdrop').hidden = !open;
  if (open) $('closeAircraftModalBtn').focus();
}

async function openAircraftModal(plane) {
  selectAircraft(plane, true);
  renderAircraftDetail(buildAircraftDetail(plane)); $('aircraftDetailStatus').textContent = '正在读取机型、运营方和航线资料…'; setAircraftModal(true);
  try {
    const params = new URLSearchParams({ icao: plane.id, callsign: plane.callsign });
    const response = await fetch(`/api/aircraft/detail?${params}`);
    if (!response.ok) throw new Error('detail unavailable');
    const enrichment = await response.json();
    renderAircraftDetail(buildAircraftDetail(plane, enrichment)); $('aircraftDetailStatus').textContent = '资料来自 ADSBDB；仅展示已获得的数据。';
  } catch { $('aircraftDetailStatus').textContent = '已显示当前实时飞行参数。'; }
}

async function refreshAircraft() {
  const origin = { latitude: preferences.latitude, longitude: preferences.longitude };
  const refreshToken = aircraftRefreshGuard.begin();
  const requestStartedAt = performance.now();
  try {
    const params = new URLSearchParams({ lat: origin.latitude, lon: origin.longitude, radius: preferences.radarRadiusNm });
    const response = await fetch(`/api/aircraft?${params}`);
    if (!response.ok) throw new Error('aircraft request failed');
    const payload = await response.json();
    if (!aircraftRefreshGuard.isCurrent(refreshToken)) return;
    aircraft = payload.aircraft.map((row) => normalizeAircraft(row, origin)).filter(Boolean).sort((a, b) => a.distanceKm - b.distanceKm); radarMode = 'live';
    aircraftRefreshMeta = { status: 'live', latencyMs: performance.now() - requestStartedAt, updatedAt: new Date() };
    $('radarSource').textContent = `实时 · ${aircraft.length}`; $('radarSource').classList.remove('demo');
  } catch {
    if (!aircraftRefreshGuard.isCurrent(refreshToken)) return;
    aircraft = []; radarMode = 'error'; aircraftRefreshMeta = { status: 'error', latencyMs: null, updatedAt: null }; $('radarSource').textContent = '数据不可用'; $('radarSource').classList.add('demo');
  }
  renderAircraftInfo(); dirty = true;
}

$('radarCanvas').addEventListener('click', (event) => { const rect = event.currentTarget.getBoundingClientRect(); const x = event.clientX - rect.left; const y = event.clientY - rect.top; const hit = radarHits.find((target) => Math.hypot(target.x - x, target.y - y) <= target.hitRadius); if (hit) selectAircraft(hit.aircraft, true); });
$('aircraftMoreBtn').addEventListener('click', () => { const selected = aircraft.find((plane) => plane.id === selectedAircraftId); if (selected) void openAircraftModal(selected); });

function setDrawer(open) { $('settingsDrawer').setAttribute('aria-hidden', String(!open)); $('drawerBackdrop').hidden = !open; if (open) $('closeSettingsBtn').focus(); }
$('settingsBtn').addEventListener('click', () => setDrawer(true)); $('closeSettingsBtn').addEventListener('click', () => setDrawer(false)); $('drawerBackdrop').addEventListener('click', () => setDrawer(false));

let editingContactIndex = null;
function localDateTimeParts(now = new Date()) {
  const offset = now.getTimezoneOffset() * 60_000;
  const local = new Date(now.getTime() - offset).toISOString();
  return { date: local.slice(0, 10), time: local.slice(11, 16) };
}
function renderContactLog() {
  const showingQso = activeLogTab === 'qso';
  $('qsoTabBtn').classList.toggle('active', showingQso);
  $('rfEventsTabBtn').classList.toggle('active', !showingQso);
  $('recentContacts').hidden = !showingQso;
  $('rfEvents').hidden = showingQso;
  $('addContactBtn').hidden = !showingQso;
  if (showingQso) renderRecentContacts($('recentContacts'), recentContactRows, document, openContactEditor);
  else renderRfEvents($('rfEvents'), rfEventRows, document, { locale: i18n.locale, emptyText: t('rf.empty') });
}
function setContactEditor(open) {
  $('contactEditorModal').setAttribute('aria-hidden', String(!open));
  document.querySelector('[data-module="contacts"]')?.classList.toggle('is-editing', open);
  if (open) $('contactCallsignInput').focus();
}
function openContactEditor(contact = null, index = null) {
  editingContactIndex = Number.isInteger(index) ? index : null;
  const current = contact ?? { ...localDateTimeParts(), callsign: '', qth: '' };
  $('contactDateInput').value = current.date || localDateTimeParts().date;
  $('contactTimeInput').value = current.time === '--:--' ? localDateTimeParts().time : (current.time || localDateTimeParts().time);
  $('contactCallsignInput').value = current.callsign || '';
  $('contactQthInput').value = current.qth === '未知 QTH' ? '' : (current.qth || '');
  $('deleteContactBtn').hidden = editingContactIndex == null;
  $('contactEditorTitle').textContent = editingContactIndex == null ? '新增通联' : '编辑通联';
  setContactEditor(true);
}
function closeContactEditor() { setContactEditor(false); editingContactIndex = null; }
$('addContactBtn').addEventListener('click', () => openContactEditor());
$('qsoTabBtn').addEventListener('click', () => { activeLogTab = 'qso'; renderContactLog(); });
$('rfEventsTabBtn').addEventListener('click', () => { activeLogTab = 'rf'; renderContactLog(); });
$('closeContactEditorBtn').addEventListener('click', closeContactEditor);
$('cancelContactBtn').addEventListener('click', closeContactEditor);
$('contactEditorModal').addEventListener('click', (event) => { if (event.target === $('contactEditorModal')) closeContactEditor(); });
$('contactEditorForm').addEventListener('submit', (event) => {
  event.preventDefault();
  recentContactRows = upsertRecentContact(recentContactRows, {
    date: $('contactDateInput').value,
    time: $('contactTimeInput').value,
    callsign: $('contactCallsignInput').value,
    qth: $('contactQthInput').value,
  }, editingContactIndex);
  recentContactRows = saveRecentContacts(localStorage, recentContactRows);
  renderContactLog(); closeContactEditor();
});
$('deleteContactBtn').addEventListener('click', () => {
  if (editingContactIndex == null) return;
  recentContactRows.splice(editingContactIndex, 1);
  recentContactRows = saveRecentContacts(localStorage, recentContactRows);
  renderContactLog(); closeContactEditor();
});
$('closeAircraftModalBtn').addEventListener('click', () => setAircraftModal(false)); $('aircraftModalBackdrop').addEventListener('click', () => setAircraftModal(false));
document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && !document.fullscreenElement) { setDrawer(false); setAircraftModal(false); closeContactEditor(); } });
$('fullscreenBtn').addEventListener('click', async () => { try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); } catch { $('pendingText').textContent = '浏览器不支持全屏'; } });
document.addEventListener('fullscreenchange', () => { $('fullscreenBtn').textContent = document.fullscreenElement ? '↙' : '⛶'; $('fullscreenBtn').title = document.fullscreenElement ? '退出全屏（Esc）' : '全屏'; });

$('avatarInput').addEventListener('change', () => { const file = $('avatarInput').files?.[0]; if (!file) return; if (file.size > 2_000_000) { $('pendingText').textContent = '头像需小于 2 MB'; return; } const reader = new FileReader(); reader.onload = () => { pendingAvatar = String(reader.result); $('avatarImage').src = pendingAvatar; $('avatarImage').classList.add('has-avatar'); }; reader.readAsDataURL(file); });
$('languageInput').addEventListener('change', () => {
  preferences = savePreferences(localStorage, { ...preferences, locale: $('languageInput').value });
  applyLanguage(preferences.locale);
});
$('saveSettingsBtn').addEventListener('click', () => {
  preferences = savePreferences(localStorage, { ...preferences, nickname: $('nicknameInput').value, callsignPrimary: $('callsignPrimaryInput').value, callsignSecondary: $('callsignSecondaryInput').value, callsignColor: $('callsignColorInput').value, callsignSize: Number($('callsignSizeInput').value), location: $('locationInput').value, locationColor: $('locationColorInput').value, locationSize: Number($('locationSizeInput').value), bio: $('bioInput').value, avatar: pendingAvatar, latitude: Number($('latitudeInput').value), longitude: Number($('longitudeInput').value), radarRadiusNm: Number($('radarRadiusInput').value), terrainMode: $('terrainModeInput').value, signalThresholdDb: Number($('signalThresholdInput').value) });
  resetSignalActivity();
  applyPreferences(); $('pendingText').textContent = '个性化已保存'; setDrawer(false); void refreshAircraft();
});
$('useLocationBtn').addEventListener('click', () => { if (!navigator.geolocation) { $('pendingText').textContent = '无法读取位置'; return; } navigator.geolocation.getCurrentPosition((position) => { $('latitudeInput').value = position.coords.latitude.toFixed(5); $('longitudeInput').value = position.coords.longitude.toFixed(5); }, () => { $('pendingText').textContent = '位置权限未开启'; }); });
$('resetLayoutBtn').addEventListener('click', () => { clearModuleLayout(localStorage); moduleLayout = {}; dashboardModules.forEach((module) => { module.style.left = ''; module.style.top = ''; module.style.zIndex = ''; }); highestModuleZ = 10; dirty = true; $('pendingText').textContent = '已恢复默认布局'; });

function resizeCanvas(canvas, context) { const dpr = Math.min(2, devicePixelRatio || 1); const rect = canvas.getBoundingClientRect(); const width = Math.max(1, Math.round(rect.width * dpr)); const height = Math.max(1, Math.round(rect.height * dpr)); if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; context.setTransform(dpr, 0, 0, dpr, 0, 0); dirty = true; } }
const observer = new ResizeObserver(() => allCanvases.forEach((canvas, index) => resizeCanvas(canvas, allContexts[index]))); allCanvases.forEach((canvas) => observer.observe(canvas));

function render(timestamp) {
  if (!document.hidden && dirty) {
    if ($('autoScale').checked && history.latest) Object.assign(view, sdrDisplayRange(history.latest.bins));
    renderSpectrum3D(spectrumContexts[0], history, view); renderSpectrum2D(spectrumContexts[1], history, view); renderWaterfall(spectrumContexts[2], history, view);
    const peak = history.latest?.bins[history.latest.peakIndex] ?? -121; renderAnalogMeter(analogContext, peak); renderDigitalMeter(digitalContext, peak, digitalMeterDbm);
    radarHits = renderRadar(radarContext, aircraft, { radiusKm: preferences.radarRadiusNm * 1.852, selectedId: selectedAircraftId, time: timestamp });
    renderRadar(insetRadarContext, aircraft, { radiusKm: preferences.radarRadiusNm * 1.852, selectedId: selectedAircraftId, time: timestamp });
    lastRadarRender = timestamp; dirty = false;
  }
  if (!document.hidden && shouldRenderRadar(timestamp, lastRadarRender)) {
    radarHits = renderRadar(radarContext, aircraft, { radiusKm: preferences.radarRadiusNm * 1.852, selectedId: selectedAircraftId, time: timestamp });
    renderRadar(insetRadarContext, aircraft, { radiusKm: preferences.radarRadiusNm * 1.852, selectedId: selectedAircraftId, time: timestamp });
    lastRadarRender = timestamp;
  }
  requestAnimationFrame(render);
}
requestAnimationFrame(render); document.addEventListener('visibilitychange', () => { dirty = true; });

function download(blob, filename) { const anchor = document.createElement('a'); anchor.href = URL.createObjectURL(blob); anchor.download = filename; anchor.click(); setTimeout(() => URL.revokeObjectURL(anchor.href), 1000); }
$('screenshotBtn').addEventListener('click', () => { const output = document.createElement('canvas'); output.width = 1600; output.height = 900; const ctx = output.getContext('2d'); ctx.fillStyle = '#050705'; ctx.fillRect(0, 0, output.width, output.height); ctx.fillStyle = '#eff6ef'; ctx.font = '700 26px system-ui'; ctx.fillText(`${preferences.callsignPrimary} · ${preferences.nickname}`, 32, 40); ctx.font = '14px ui-monospace'; ctx.fillStyle = '#8da091'; ctx.fillText(`${$('centerReadout').textContent} · ${$('peakReadout').textContent}`, 32, 66); ctx.drawImage($('analogMeter'), 30, 90, 300, 260); ctx.drawImage($('digitalMeter'), 30, 370, 300, 130); ctx.drawImage($('spectrum3d'), 350, 90, 850, 480); ctx.drawImage($('radarCanvas'), 1220, 90, 350, 350); ctx.drawImage($('spectrum2d'), 350, 590, 590, 270); ctx.drawImage($('waterfall'), 960, 590, 610, 270); output.toBlob((blob) => blob && download(blob, `spectrumlink-${Date.now()}.png`)); });
$('diagnosticsBtn').addEventListener('click', () => { const diagnostics = { generatedAt: new Date().toISOString(), protocol: 1, radioIdentity, radioStatus, browser: navigator.userAgent, source, radarMode, aircraftCount: aircraft.length, transitions, sequenceGaps: history.diagnostics.sequenceGaps, parser: serial.parserStats, droppedFrames: radioStatus?.droppedFrames ?? null, centerHz: history.latest?.centerHz ?? null, spanHz: history.latest ? history.latest.stepHz * 64 : null, sweeps: sweepSummaries }; download(new Blob([JSON.stringify(diagnostics, null, 2)], { type: 'application/json' }), `spectrumlink-diagnostics-${Date.now()}.json`); });

if (!('serial' in navigator)) $('compatibility').textContent = '当前浏览器不支持 Web Serial；演示模式仍可使用';
if (!document.documentElement.requestFullscreen) $('fullscreenBtn').disabled = true;
aircraft3dViewer?.setShotChangeHandler((shotId) => {
  currentTerrainShot = shotId;
  if (preferences.terrainMode !== 'local3d') ensureTerrainMap()?.setPresentation(shotId);
});
applyLanguage(preferences.locale); applyPreferences(); renderContactLog(); installModuleDragging(); createModuleFocusController({ modules: dashboardModules, root: dashboardCanvas }); createPanelFocusController({ panels: [...document.querySelectorAll('[data-focus-panel]')], root: dashboardCanvas }); applyModuleLayout(); window.addEventListener('resize', applyModuleLayout); renderAircraftInfo(); setState('idle'); void refreshAircraft(); setInterval(refreshAircraft, 15_000);
setInterval(() => {
  if (!shouldAdvanceAircraftCarousel({ hidden: document.hidden, pausedUntil: carouselPausedUntil, now: Date.now(), count: aircraft.length, modalOpen: $('aircraftModal').getAttribute('aria-hidden') === 'false', modelLoading: aircraftModelLoading })) return;
  const id = nextAircraftId(aircraft, selectedAircraftId); selectAircraft(aircraft.find((plane) => plane.id === id));
}, AIRCRAFT_CAROUSEL_INTERVAL_MS);
if (new URLSearchParams(location.search).get('demo') === '1') $('demoBtn').click();

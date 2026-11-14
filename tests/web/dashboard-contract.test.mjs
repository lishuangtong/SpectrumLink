import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const htmlUrl = new URL('../../web/index.html', import.meta.url);
const cssUrl = new URL('../../web/styles.css', import.meta.url);
const appUrl = new URL('../../web/src/app.js', import.meta.url);
const aircraft3dUrl = new URL('../../web/src/aircraft-3d.js', import.meta.url);
const packageUrl = new URL('../../package.json', import.meta.url);

test('dashboard preserves all spectrum views and adds identity, meters and radar', async () => {
  const html = await readFile(htmlUrl, 'utf8');
  for (const id of ['spectrum3d', 'spectrum2d', 'waterfall', 'analogMeter', 'digitalMeter', 'radarCanvas']) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  for (const id of ['avatarImage', 'nicknameReadout', 'primaryCallsign', 'secondaryCallsign']) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
});

test('settings are a closed dialog drawer and fullscreen has a dedicated control', async () => {
  const html = await readFile(htmlUrl, 'utf8');
  assert.match(html, /id="settingsDrawer"[^>]*aria-hidden="true"/);
  assert.match(html, /id="fullscreenBtn"/);
  assert.match(html, /id="settingsBtn"/);
  assert.match(html, /id="callsignPrimaryInput"/);
  assert.match(html, /id="avatarInput"[^>]*type="file"/);
  assert.match(html, /id="resetLayoutBtn"/);
});

test('settings drawer credits the designer, website and current semantic version', async () => {
  const html = await readFile(htmlUrl, 'utf8');
  const css = await readFile(cssUrl, 'utf8');
  const packageJson = JSON.parse(await readFile(packageUrl, 'utf8'));
  assert.match(html, /class="author-credit"/);
  assert.match(html, /Designed by：\s*<a[^>]*href="https:\/\/v\.douyin\.com\/llSXBPzpKzI\/"[^>]*>鸽子TechLife<\/a>/);
  assert.match(html, /Website：\s*<a[^>]*href="https:\/\/www\.lishuangtong\.com"[^>]*>鸽子窝<\/a>/);
  assert.match(html, new RegExp(`Version：\\s*v${packageJson.version.replaceAll('.', '\\.')}`));
  assert.match(packageJson.version, /^\d+\.\d+\.\d+$/);
  assert.match(css, /\.settings-drawer\s*\{[^}]*grid-template-rows:\s*68px\s+minmax\(0,1fr\)\s+38px/s);
});

test('1024x768 layout uses a fixed dashboard viewport and hides the closed drawer', async () => {
  const css = await readFile(cssUrl, 'utf8');
  assert.match(css, /body\s*\{[^}]*overflow:\s*hidden/s);
  assert.match(css, /\.settings-drawer\[aria-hidden="true"\]/);
  assert.match(css, /@media\s*\(max-width:\s*1100px\)/);
});

test('all visual modules are draggable and the obsolete station status module is removed', async () => {
  const html = await readFile(htmlUrl, 'utf8');
  for (const name of ['analog', 'digital', 'contacts', 'terrain', 'live', 'waterfall', 'radar']) {
    assert.match(html, new RegExp(`data-module="${name}"`));
  }
  assert.doesNotMatch(html, /station-module|工作状态/);
});

test('primary callsign is centered in the profile and not duplicated in the signal header', async () => {
  const html = await readFile(htmlUrl, 'utf8');
  const css = await readFile(cssUrl, 'utf8');
  const profile = html.match(/profile-module[^>]*>[\s\S]*?<\/article>/)?.[0] ?? '';
  const signal = html.match(/analog-module[^>]*>[\s\S]*?<\/article>/)?.[0] ?? '';
  assert.match(profile, /id="primaryCallsign"/);
  assert.doesNotMatch(signal, /id="primaryCallsign"/);
  assert.match(css, /\.profile-callsign\s*\{[^}]*text-align:\s*center/s);
  assert.match(css, /\.digital-module\[data-module\]\s*\{[^}]*top:\s*0/s);
  assert.match(css, /\.analog-module\[data-module\]\s*\{[^}]*top:\s*32%/s);
});

test('aircraft UI contains a real-detail dialog and no simulated-target fallback', async () => {
  const html = await readFile(htmlUrl, 'utf8');
  const app = await readFile(appUrl, 'utf8');
  assert.match(html, /id="aircraftModal"[^>]*aria-hidden="true"/);
  assert.match(html, /id="aircraftDetailGrid"/);
  assert.doesNotMatch(app, /demoAircraft|演示目标/);
});

test('radar uses an animated 3D aircraft showcase and carousel without missing-data copy', async () => {
  const html = await readFile(htmlUrl, 'utf8');
  const css = await readFile(cssUrl, 'utf8');
  const app = await readFile(appUrl, 'utf8');
  for (const id of ['aircraftShowcase', 'aircraftModel3d', 'aircraftCarousel', 'aircraftMoreBtn']) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(css, /perspective:\s*\d+px/);
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  assert.doesNotMatch(`${html}\n${app}`, /暂无公开数据/);
});

test('operator header carries the slogan and customizable city while the digital meter sits under frequency data', async () => {
  const html = await readFile(htmlUrl, 'utf8');
  for (const id of ['locationReadout', 'sloganReadout', 'locationInput', 'bioInput', 'locationColorInput', 'locationSizeInput']) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(html, /identity-copy[\s\S]*?id="nicknameReadout"[\s\S]*?id="sloganReadout"/);
  assert.match(html, /frequency-deck[\s\S]*?id="digitalMeter"/);
  const signal = html.match(/analog-module[^>]*>[\s\S]*?<\/article>/)?.[0] ?? '';
  assert.match(signal, /id="analogMeter"/);
  assert.doesNotMatch(signal, /id="digitalMeter"|数字表\s*\/\s*机械表/);
});

test('dashboard uses a real WebGL aircraft canvas and the annotated integrated layout', async () => {
  const html = await readFile(htmlUrl, 'utf8');
  const app = await readFile(appUrl, 'utf8');
  assert.match(html, /<canvas\s+id="aircraftModel3d"/);
  assert.doesNotMatch(html, /model-geometry|3D 姿态示意/);
  assert.match(app, /Aircraft3DViewer/);
  assert.match(html, /identity-copy[\s\S]*?id="sloganReadout"/);
  assert.match(html, /profile-module[^>]*>[\s\S]*?id="primaryCallsign"/);
  assert.doesNotMatch(html, />个人信息</);
  assert.match(html, /terrain-module integrated-module/);
});

test('aircraft viewer keeps data and model credits out of the main radar panel', async () => {
  const html = await readFile(htmlUrl, 'utf8');
  const app = await readFile(appUrl, 'utf8');
  const viewer = await readFile(aircraft3dUrl, 'utf8');
  const radar = html.match(/<aside class="module radar-module"[\s\S]*?<\/aside>/)?.[0] ?? '';
  const settings = html.match(/<aside[^>]*id="settingsDrawer"[\s\S]*?<\/aside>/)?.[0] ?? '';
  assert.match(html, /type="importmap"/);
  assert.doesNotMatch(radar, /radar-credit|modelCredits|数据：adsb\.lol/);
  assert.match(settings, /<details class="source-credit">/);
  assert.match(settings, /Flightradar24\/fr24-3d-models/);
  assert.match(settings, /amvlab\/aircraft-models/);
  assert.match(settings, /bilawalsidhu\/gods-eye-view/);
  assert.match(viewer, /GLTFLoader/);
  assert.match(viewer, /\/api\/aircraft\/model\?type=/);
  assert.match(app, /setAircraft\(model, selected\?\.type\)/);
});

test('operator callsign remains unframed with configurable color and size', async () => {
  const html = await readFile(htmlUrl, 'utf8');
  const css = await readFile(cssUrl, 'utf8');
  const app = await readFile(appUrl, 'utf8');
  assert.match(html, /class="profile-display"[\s\S]*?id="primaryCallsign"/);
  assert.doesNotMatch(html.match(/class="profile-display"[\s\S]*?<\/article>/)?.[0] ?? '', /id="sloganReadout"/);
  assert.match(html, /id="callsignColorInput"[^>]*type="color"/);
  assert.match(html, /id="callsignSizeInput"[^>]*type="range"/);
  assert.match(css, /\.profile-display\s*\{[^}]*border:\s*0/s);
  assert.match(css, /\.topbar\s*\{[^}]*background:\s*transparent/s);
  assert.match(app, /--callsign-color/);
});

test('annotated wide layout gives the aircraft column thirty percent of the canvas', async () => {
  const css = await readFile(cssUrl, 'utf8');
  assert.match(css, /\.digital-module\[data-module\]\s*\{[^}]*width:\s*28%/s);
  assert.match(css, /\.analog-module\[data-module\]\s*\{[^}]*width:\s*28%/s);
  assert.match(css, /\.terrain-module\[data-module\]\s*\{[^}]*left:\s*28\.6%[^}]*width:\s*41\.2%/s);
  assert.match(css, /\.radar-module\[data-module\]\s*\{[^}]*left:\s*70\.4%[^}]*width:\s*29\.6%/s);
});

test('aircraft showcase uses a project scenic backdrop and exposes active model attribution', async () => {
  const html = await readFile(htmlUrl, 'utf8');
  const css = await readFile(cssUrl, 'utf8');
  const viewer = await readFile(aircraft3dUrl, 'utf8');
  assert.match(html, /id="activeModelCredit"/);
  assert.match(css, /aircraft-mountain-sky\.png/);
  assert.match(css, /\.aircraft-model-stage\s*\{[^}]*min-height:\s*0/s);
  assert.match(viewer, /dataset\.modelProvider/);
  assert.match(viewer, /modelFitScale/);
});

test('online terrain modes do not reveal the offline mountain backdrop behind transparent map pixels', async () => {
  const css = await readFile(cssUrl, 'utf8');
  assert.match(css, /\.aircraft-model-stage\[data-terrain-mode="open3d"\][^{]*,[^{]*\.aircraft-model-stage\[data-terrain-mode="flat2d"\]\s*\{[^}]*background-image:\s*none/s);
});

test('every draggable module receives the shared maximize controller', async () => {
  const app = await readFile(appUrl, 'utf8');
  const css = await readFile(cssUrl, 'utf8');
  assert.match(app, /createModuleFocusController/);
  assert.match(css, /\.module\[data-module\]\.is-focused/);
  assert.match(css, /\.module-focus-btn/);
  assert.match(css, /\.module\[data-module\]\.is-focused\s*\{[^}]*inset:\s*6px\s*!important[^}]*left:\s*6px\s*!important[^}]*top:\s*6px\s*!important/s);
});

test('aircraft showcase and flight carousel expose independent presentation controls', async () => {
  const html = await readFile(htmlUrl, 'utf8');
  const app = await readFile(appUrl, 'utf8');
  const css = await readFile(cssUrl, 'utf8');
  assert.match(html, /id="aircraftShowcase"[^>]*data-focus-panel="aircraft"/);
  assert.match(html, /data-focus-panel="flights"[\s\S]*?id="aircraftCarousel"/);
  assert.equal((html.match(/data-focus-toggle/g) ?? []).length, 2);
  assert.match(app, /createPanelFocusController/);
  assert.match(css, /\.is-panel-focused/);
});

test('aircraft selection uses the eased fifteen-second showcase transition', async () => {
  const app = await readFile(appUrl, 'utf8');
  const css = await readFile(cssUrl, 'utf8');
  assert.match(app, /createAircraftTransitionController/);
  assert.match(app, /AIRCRAFT_CAROUSEL_INTERVAL_MS/);
  assert.match(css, /\.aircraft-showcase\.is-switching-out/);
  assert.match(css, /@keyframes\s+aircraft-switch-in/);
  assert.match(css, /\.carousel-progress i\.running\s*\{[^}]*animation:\s*carousel-progress 15s/s);
});

test('focused aircraft presentation uses a flight-data sidebar and Taiyuan inset radar', async () => {
  const html = await readFile(htmlUrl, 'utf8');
  const app = await readFile(appUrl, 'utf8');
  const css = await readFile(cssUrl, 'utf8');
  assert.match(html, /id="aircraftInsetRadar"/);
  assert.match(html, /class="aircraft-inset-radar"/);
  assert.match(app, /aircraftInsetRadar/);
  assert.match(css, /\.aircraft-showcase\.is-panel-focused \.aircraft-showcase-copy\s*\{[^}]*width:\s*240px[^}]*bottom:\s*0/s);
  assert.match(css, /\.aircraft-showcase\.is-panel-focused \.aircraft-inset-radar\s*\{[^}]*display:\s*block/s);
});

test('left column gives recent contacts the tall middle section and keeps the mechanical meter compact', async () => {
  const html = await readFile(htmlUrl, 'utf8');
  const css = await readFile(cssUrl, 'utf8');
  const app = await readFile(appUrl, 'utf8');
  assert.match(html, /data-module="contacts"/);
  assert.match(html, /id="recentContacts"/);
  assert.match(app, /renderRecentContacts/);
  assert.match(css, /\.contacts-module\[data-module\]\s*\{[^}]*top:\s*20%[^}]*height:\s*45%/s);
  assert.match(css, /\.analog-module\[data-module\]\s*\{[^}]*top:\s*66%[^}]*height:\s*34%/s);
});

test('iPad-width callsign reserves safe width and scales inside its own container', async () => {
  const css = await readFile(cssUrl, 'utf8');
  assert.match(css, /\.profile-display\s*\{[^}]*container-type:\s*inline-size/s);
  assert.match(css, /\.profile-callsign\s*\{[^}]*max-width:\s*calc\(100%\s*-\s*20px\)[^}]*font-size:\s*min\(var\(--callsign-size\),\s*18cqw\)/s);
});

test('aircraft viewer runs the four-shot flight director for every selected aircraft', async () => {
  const app = await readFile(appUrl, 'utf8');
  const viewer = await readFile(aircraft3dUrl, 'utf8');
  assert.match(app, /aircraft3dViewer\?\.startShotCycle\(\)/);
  assert.match(viewer, /aircraftShotFrame/);
  assert.match(viewer, /aircraftFlightMotion/);
  assert.match(viewer, /AIRCRAFT_MANUAL_HOLD_MS/);
  assert.match(viewer, /setShotChangeHandler/);
  assert.match(app, /terrainMap\?\.setFlight/);
  assert.match(app, /terrainMap\?\.setPresentation/);
});

test('focused radar module enlarges only the radar and hides aircraft presentation content', async () => {
  const css = await readFile(cssUrl, 'utf8');
  assert.match(css, /\.radar-module\.is-focused\s*\{[^}]*grid-template-rows:\s*46px\s+minmax\(0,\s*1fr\)/s);
  assert.match(css, /\.radar-module\.is-focused\s+:is\(\.aircraft-showcase,\s*\.aircraft-carousel-panel,\s*\.airspace-summary\)\s*\{[^}]*display:\s*none/s);
});

test('radar footer shows a compact live airspace summary without another data source', async () => {
  const html = await readFile(htmlUrl, 'utf8');
  const app = await readFile(appUrl, 'utf8');
  const css = await readFile(cssUrl, 'utf8');
  const radar = html.match(/<aside class="module radar-module"[\s\S]*?<\/aside>/)?.[0] ?? '';

  for (const id of ['airspaceSummary', 'airspaceCount', 'airspaceNearest', 'airspaceHighest', 'airspaceLatency', 'airspaceUpdated']) {
    assert.match(radar, new RegExp(`id="${id}"`));
  }
  assert.match(app, /buildAirspaceSummary/);
  assert.match(app, /performance\.now\(\)/);
  assert.match(app, /aircraftRefreshGuard\.isCurrent\(refreshToken\)/);
  assert.match(css, /\.airspace-summary\s*\{[^}]*display:\s*grid/s);
  assert.match(css, /@media\s*\(max-width:\s*1100px\)[\s\S]*?\.airspace-summary\s*\{[^}]*font-size:\s*8px/s);
  assert.match(css, /@media\s*\(max-width:\s*1100px\)[\s\S]*?\.airspace-summary i\s*\{[^}]*display:\s*none/s);
});

test('recent QSO table is date-time, callsign and QTH with a local editor', async () => {
  const html = await readFile(htmlUrl, 'utf8');
  const app = await readFile(appUrl, 'utf8');
  const contacts = await readFile(new URL('../../web/src/recent-contacts.js', import.meta.url), 'utf8');
  for (const id of ['addContactBtn', 'contactEditorModal', 'contactCallsignInput', 'contactQthInput', 'contactDateInput', 'contactTimeInput', 'saveContactBtn', 'deleteContactBtn']) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(app, /loadRecentContacts/);
  assert.match(app, /saveRecentContacts/);
  assert.match(app, /upsertRecentContact/);
  assert.match(contacts, /row\.append\(time, callsign, qth\)/);
});

test('wide monitors distribute recent QSO columns across the available module width', async () => {
  const css = await readFile(cssUrl, 'utf8');
  assert.match(css, /\.contacts-module\s*\{[^}]*container-type:\s*inline-size/s);
  assert.match(css, /@container\s*\(min-width:\s*420px\)[\s\S]*?\.contact-table-head,[\s\S]*?\.contact-row\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/s);
});

test('terrain backend can use offline 3D, keyless open 3D or a 2D fallback', async () => {
  const html = await readFile(htmlUrl, 'utf8');
  const app = await readFile(appUrl, 'utf8');
  const viewer = await readFile(aircraft3dUrl, 'utf8');
  assert.match(html, /id="terrainModeInput"[\s\S]*value="local3d"[\s\S]*value="open3d"[\s\S]*value="flat2d"/);
  assert.match(html, /id="aircraftModelStage"[^>]*data-terrain-mode="open3d"/);
  assert.match(app, /preferences\.terrainMode/);
  assert.match(app, /onUnavailable/);
  assert.match(viewer, /setTerrainMode/);
  assert.match(viewer, /createLocalTerrainMesh/);
});

test('waterfall defaults to a dense SDR-style history', async () => {
  const html = await readFile(htmlUrl, 'utf8');
  const app = await readFile(appUrl, 'utf8');
  assert.match(html, /id="depthInput"[\s\S]*value="192"/);
  assert.match(app, /new SpectrumHistory\(\{ depth: 192 \}\)/);
});

test('dashboard integrates RF activity without adding another module', async () => {
  const html = await readFile(htmlUrl, 'utf8');
  const app = await readFile(appUrl, 'utf8');
  const css = await readFile(cssUrl, 'utf8');
  for (const id of ['rxActivity', 'rxActivityFrequency', 'rxActivityDuration', 'qsoTabBtn', 'rfEventsTabBtn', 'signalThresholdInput', 'signalThresholdOut']) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.equal((html.match(/data-module=/g) ?? []).length, 7);
  assert.match(app, /createSignalActivityDetector/);
  assert.match(app, /renderRfEvents/);
  assert.match(app, /view\.peakMarkers/);
  assert.match(app, /view\.rfEvents/);
  assert.match(css, /\.rx-activity\.active/);
  assert.match(css, /\.contact-tabs/);
});

test('aircraft viewer never floats detached model labels over the airframe', async () => {
  const viewer = await readFile(aircraft3dUrl, 'utf8');
  assert.doesNotMatch(viewer, /createFuselageLabel/);
  assert.doesNotMatch(viewer, /fuselage-model-marking/);
  assert.doesNotMatch(viewer, /setFuselageLabel/);
});


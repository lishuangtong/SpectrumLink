# Instrument Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a 1024×768 fullscreen FMO-inspired SpectrumLink dashboard with customizable identity, dual signal meters, live ADS-B radar, and hidden settings while preserving all spectrum views.

**Architecture:** Keep the existing buildless ES-module frontend and Node static server. Add focused state, meter, radar and settings modules; let the server proxy the public ADS-B endpoint so the UI sees one normalized local API.

**Tech Stack:** HTML, CSS, Canvas 2D, browser localStorage/Fullscreen/File APIs, Node 22 built-in HTTP/fetch, node:test.

**Spec:** `docs/superpowers/specs/2026-11-04-instrument-dashboard-design.md`

## Global Constraints

- Target viewport is 1024×768 landscape with no document scrolling.
- Settings forms are invisible when the drawer is closed.
- Aircraft data is independent from K1 data and must be labelled as network ADS-B.
- No transmit controls or radio TX APIs.
- No build step or third-party runtime dependencies.

## Review Focus

- Corrupt or missing localStorage preferences must fall back safely.
- Aircraft without position, callsign, altitude or speed must not break radar rendering.
- ADS-B upstream timeout/error must return a bounded error and switch UI to demo targets.
- Fullscreen API absence must leave a usable button state and not throw.
- 1024×768 must show all core panels without overlap or scrolling.

---

### Task 1: Preference and aircraft data models

**Files:**
- Create: `web/src/preferences.js`
- Create: `web/src/aircraft.js`
- Test: `tests/web/preferences.test.mjs`
- Test: `tests/web/aircraft.test.mjs`

**Interfaces:**
- Produces: `loadPreferences(storage)`, `savePreferences(storage, value)`, `normalizeAircraft(raw, origin)`, `demoAircraft(origin)`, `bearingDistance(origin, target)`.

- [ ] Write failing tests for defaults, sanitization, persistence, missing aircraft fields, geodesic distance/bearing and deterministic demo targets.
- [ ] Run focused tests and verify failure due to missing modules.
- [ ] Implement the minimal pure data modules.
- [ ] Run focused and full tests.
- [ ] Commit.

### Task 2: ADS-B server proxy and radar renderer

**Files:**
- Create: `web/src/render-radar.js`
- Modify: `scripts/serve.mjs`
- Test: `tests/web/radar.test.mjs`
- Test: `tests/server.test.mjs`

**Interfaces:**
- Consumes: normalized aircraft from Task 1.
- Produces: `renderRadar(ctx, aircraft, options)` and `createSpectrumServer({ fetchFn, root })`.

- [ ] Write failing tests for polar projection, selectable hit regions, API input validation, normalization and upstream failure.
- [ ] Run focused tests and verify expected failures.
- [ ] Implement renderer and server `/api/aircraft` proxy with an 8-second timeout.
- [ ] Run focused and full tests.
- [ ] Commit.

### Task 3: Dual meters, identity card and hidden settings

**Files:**
- Create: `web/src/render-meter.js`
- Modify: `web/index.html`
- Modify: `web/styles.css`
- Modify: `web/src/app.js`
- Test: `tests/web/meter.test.mjs`
- Test: `tests/web/dashboard-contract.test.mjs`

**Interfaces:**
- Consumes: preferences and aircraft modules from Task 1, radar renderer from Task 2.
- Produces: analog/LED meter rendering and the complete dashboard DOM contract.

- [ ] Write failing tests for dBm-to-S-unit mapping, needle angle, identity fields, drawer semantics, fullscreen control and preserved spectrum canvases.
- [ ] Run focused tests and verify expected failures.
- [ ] Implement meter renderer, dashboard markup, styling and application wiring.
- [ ] Run focused and full tests.
- [ ] Commit.

### Task 4: Visual acceptance and documentation

**Files:**
- Modify: `README.md`
- Modify: `docs/install-and-test-zh.md`

**Interfaces:**
- Consumes: completed dashboard.
- Produces: launch/usage guidance and visual acceptance evidence.

- [ ] Run full Node and radio suites.
- [ ] Capture 1024×768 and 1440×900 screenshots in demo mode and inspect for overlap, clipping, scrollbars and readability.
- [ ] Correct visual defects without changing behavior, rerun tests and screenshots.
- [ ] Document fullscreen, identity customization, ADS-B attribution/requirements and fallback behavior.
- [ ] Commit and run final verification.


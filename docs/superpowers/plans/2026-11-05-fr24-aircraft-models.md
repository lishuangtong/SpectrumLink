# FR24 Aircraft Models Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace supported procedural aircraft with exact Flightradar24 GLB models while preserving a reliable procedural fallback.

**Architecture:** A shared whitelist maps ICAO type codes to FR24 model filenames. The local server proxies only those filenames from a CDN URL pinned to the verified FR24 Git commit, and the WebGL viewer uses Three.js GLTFLoader to normalize and display the selected model. Unsupported types and load failures retain the existing procedural mesh.

**Tech Stack:** JavaScript ES modules, Node HTTP server, Three.js 0.187 GLTFLoader, Node test runner.

**Spec:** `docs/superpowers/specs/2026-11-04-instrument-dashboard-design.md`

## Global Constraints

- Preserve 1024×768 dashboard layout and existing drag/fullscreen behavior.
- Load only the currently selected model; do not download the complete FR24 library.
- Never substitute an unrelated GLB for an unsupported ICAO type.
- Preserve GPLv2 attribution and source links.

## Review Focus

- Unsupported or malformed ICAO codes return no asset and make no upstream request.
- Upstream model failures retain the procedural model.
- A stale asynchronous load cannot replace a newer aircraft selection.
- GLB geometry is centered and scaled into the existing stage.
- Browser and server cache headers avoid repeated multi-megabyte transfers.

---

### Task 1: ICAO model whitelist

**Files:**
- Create: `web/src/aircraft-model-assets.js`
- Create: `tests/web/aircraft-model-assets.test.mjs`
- Modify: `web/src/aircraft-carousel.js`

**Interfaces:**
- Produces: `aircraftModelAsset(type): { filename, sourceUrl } | null`.

- [x] Write mapping tests for exact common types and unsupported variants; unsupported variants must keep the existing type-matched procedural model rather than borrow a visually similar FR24 model.
- [ ] Run the focused test and confirm it fails because the module is missing.
- [ ] Implement the static whitelist and extend display names for newly supported types.
- [ ] Run focused tests and commit the green task.

### Task 2: Controlled model proxy and licensing

**Files:**
- Modify: `scripts/serve.mjs`
- Modify: `tests/server.test.mjs`
- Modify: `web/index.html`
- Add: `web/assets/licenses/FR24-3D-MODELS-GPL-2.0.txt`

**Interfaces:**
- Consumes: `aircraftModelAsset(type)`.
- Produces: `GET /api/aircraft/model?type=<ICAO>` returning `model/gltf-binary` with cache headers.

- [ ] Write route tests for successful binary proxy, unsupported type, and bounded upstream failure.
- [ ] Run the route tests and confirm they fail with the missing endpoint.
- [ ] Implement the route, attribution link, and bundled license.
- [ ] Run server tests and commit the green task.

### Task 3: GLB WebGL viewer with fallback

**Files:**
- Modify: `web/src/aircraft-3d.js`
- Modify: `web/src/app.js`
- Add: `web/vendor/addons/loaders/GLTFLoader.js`
- Add: `web/vendor/addons/utils/BufferGeometryUtils.js`
- Add: `web/vendor/addons/utils/SkeletonUtils.js`
- Modify: `web/index.html`
- Test: `tests/web/dashboard-contract.test.mjs`

**Interfaces:**
- Consumes: model endpoint and selected ICAO type.
- Produces: asynchronous `Aircraft3DViewer.setAircraft(profile, type)` with race-safe procedural fallback.

- [ ] Add a failing dashboard contract test for GLTFLoader integration and attribution.
- [ ] Run it and confirm it fails for the missing loader.
- [ ] Vendor Three.js addons, load and normalize GLB scenes, and protect against stale requests.
- [ ] Run all tests, perform a 1024×768 browser check, build firmware, and commit.

### Task 4: Unified operator panel and configurable callsign color

**Files:**
- Modify: `web/index.html`
- Modify: `web/styles.css`
- Modify: `web/src/preferences.js`
- Modify: `web/src/app.js`
- Test: `tests/web/preferences.test.mjs`
- Test: `tests/web/dashboard-contract.test.mjs`

**Interfaces:**
- Produces: persisted `callsignColor` hex preference and a visually continuous identity/profile panel.

- [ ] Add failing tests for color sanitization, settings control, green inner frame, and split frequency header.
- [ ] Run focused tests and confirm the new contracts fail.
- [ ] Implement the preference, input binding, HTML wrapper, and aligned left-column layout.
- [ ] Run focused and full tests, then include the result in final browser verification.

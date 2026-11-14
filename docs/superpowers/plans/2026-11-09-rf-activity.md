# RF Activity Enhancement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add reliable RF activity detection, peak annotations and event history to the existing dashboard without adding a module.

**Architecture:** A pure signal-activity module consumes decoded sweeps and produces detector state, top peaks and bounded events. The app feeds those results into small DOM status views and passes annotations to the existing canvas renderers.

**Tech Stack:** Browser ES modules, Canvas 2D, Web Serial sweep data, Node test runner.

**Spec:** `docs/superpowers/specs/2026-11-09-rf-activity-design.md`

## Global Constraints

- A detected event means RF carrier activity, not decoded voice.
- Default sensitivity is 12 dB above adaptive noise floor.
- Activation requires two consecutive qualifying sweeps; release hold is 500 ms.
- No new dashboard module and no loss of QSO editing.

## Review Focus

- Flat/noisy sweeps must not trigger an event.
- Multiple adjacent bins from one carrier must produce one peak marker.
- Rapid threshold crossings must not create duplicate events.
- Invalid saved sensitivity must fall back to 12 dB.
- Empty RF history must render a useful empty state.

---

### Task 1: RF detector and event model

**Files:**
- Create: `web/src/signal-activity.js`
- Test: `tests/web/signal-activity.test.mjs`

**Interfaces:**
- Produces: `estimateNoiseFloor(bins)`, `findTopPeaks(sweep, options)`, `createSignalActivityDetector(options)`.

- [x] Write failing tests for noise rejection, two-sweep activation, release hold, event completion and separated top-three peaks.
- [x] Run the focused test and confirm it fails because the module is absent.
- [x] Implement the minimal pure detector and peak functions.
- [x] Run the focused test and confirm it passes.

### Task 2: Persisted sensitivity and RF event table

**Files:**
- Modify: `web/src/preferences.js`
- Create: `web/src/rf-events.js`
- Modify: `web/src/recent-contacts.js`
- Test: `tests/web/preferences.test.mjs`
- Test: `tests/web/rf-events.test.mjs`

**Interfaces:**
- Consumes: completed detector events.
- Produces: sanitized persisted sensitivity and a read-only RF event renderer.

- [x] Write failing tests for 12 dB default/clamping, bounded storage and event-table output.
- [x] Run focused tests and confirm the expected failures.
- [x] Implement preference/storage/rendering behavior.
- [x] Run focused tests and confirm they pass.

### Task 3: Dashboard integration and chart annotations

**Files:**
- Modify: `web/index.html`
- Modify: `web/styles.css`
- Modify: `web/src/app.js`
- Modify: `web/src/render-2d.js`
- Modify: `web/src/render-waterfall.js`
- Modify: `web/src/i18n.js`
- Test: `tests/web/renderers.test.mjs`
- Test: `tests/web/dashboard-contract.test.mjs`

**Interfaces:**
- Consumes: detector state, peak list and RF event rows.
- Produces: status cue, chart markers, QSO/RF tabs and sensitivity control.

- [x] Write failing contract and renderer tests for the five approved UI additions.
- [x] Run focused tests and confirm the expected failures.
- [x] Integrate the detector and renderers, preserving the three-column layout.
- [x] Run focused tests, then the full test suite and distribution verification.


# Airspace Status Bar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fill the radar footer with a compact, truthful summary of the current ADS-B airspace.

**Architecture:** A pure helper derives summary values from the normalized aircraft array. The existing refresh path measures request duration, updates the summary DOM after every result, and the radar layout reserves a compact responsive row for it.

**Tech Stack:** Browser ES modules, HTML/CSS, Node test runner.

**Spec:** `docs/superpowers/specs/2026-11-09-airspace-status-design.md`

## Global Constraints

- Reuse the existing aircraft request and normalized aircraft records.
- Simplified Chinese remains the default locale.
- Maximized radar remains radar-only.
- Do not expose source/model credits in the main radar panel.

## Review Focus

- Empty aircraft arrays must not produce `Infinity`, `NaN`, or fake flight values.
- Invalid altitude and distance values must be ignored safely.
- Failed refreshes must visibly report unavailable data without retaining a false success timestamp.
- Compact layout must not overflow the radar column at iPad width.
- Locale changes must immediately refresh the runtime status text.

---

### Task 1: Derived airspace summary and responsive status bar

**Files:**
- Create: `web/src/airspace-summary.js`
- Create: `tests/web/airspace-summary.test.mjs`
- Modify: `tests/web/dashboard-contract.test.mjs`
- Modify: `web/index.html`
- Modify: `web/src/app.js`
- Modify: `web/src/i18n.js`
- Modify: `web/styles.css`

**Interfaces:**
- Produces: `buildAirspaceSummary(aircraft, { latencyMs, updatedAt, status })` returning `{ status, count, nearestCallsign, nearestDistanceKm, highestAltitudeFt, latencyMs, updatedAt }`.
- Consumes: normalized aircraft fields `callsign`, `distanceKm`, and `altitudeFt` from `web/src/aircraft.js`.

- [ ] **Step 1: Write failing helper and dashboard contract tests**

Cover populated data, invalid/empty data, the five status fields, compact layout, and radar-only focus behavior.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `node --test tests/web/airspace-summary.test.mjs tests/web/dashboard-contract.test.mjs`

Expected: FAIL because the helper and status bar do not exist.

- [ ] **Step 3: Implement the helper and status bar**

Add the pure summary helper, status markup, localized rendering, refresh timing, responsive CSS, and focused-radar hiding.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `node --test tests/web/airspace-summary.test.mjs tests/web/dashboard-contract.test.mjs`

Expected: PASS.

- [ ] **Step 5: Verify the full product**

Run: `npm test && node --check web/src/app.js && bash scripts/verify-dist.sh && git diff --check`

Expected: all tests and checks pass with no errors.

- [ ] **Step 6: Commit**

Commit message: `feat: add live airspace status bar`

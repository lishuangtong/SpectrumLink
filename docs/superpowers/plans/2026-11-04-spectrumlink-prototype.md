# SpectrumLink Prototype Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and package a receive-only F4HWN Labs v6.3.0 overlay app that streams 64-bin UV-K1 sweeps over USB-C, plus a local Chromium web application that renders synchronized 2D spectrum, waterfall, and color 3D history.

**Architecture:** `SpectrumLink.app` owns BK4829 sequential scanning and a small framed USB protocol; it never transmits and restores the receiver on exit or host loss. A dependency-free browser client connects with Web Serial, parses sweep packets, maintains display history, and renders three views locally. Synthetic sweeps and host-compiled firmware harnesses make most behavior testable before the user's physical radio is connected.

**Tech Stack:** C11/Cortex-M0+ F4HWN overlay API level 3, Dockerized `arm-none-eabi-gcc`, Python 3 host harness, JavaScript ES modules, Node 26 built-in test runner, Web Serial, Canvas 2D.

**Spec:** `docs/superpowers/specs/2026-11-04-spectrumlink-design.md`

## Global Constraints

- Target only Quansheng UV-K1 / UV-K1(8) running F4HWN Labs `v6.3.0`; pin all overlay headers and build tools to upstream tag `v6.3.0`.
- The radio artifact must declare API minimum `3` and capability `serial`, and its overlay code/data/BSS must remain within `4096` bytes.
- The radio side is receive-only: do not call or link transmit callbacks, and ignore PTT.
- Use exactly 64 RSSI bins and the official total sweep widths `400 kHz`, `800 kHz`, `1.6 MHz`, and `3.2 MHz`.
- Treat RSSI values as F4HWN-corrected dBm, not laboratory-calibrated absolute measurements.
- The app may exclusively own native USB-C CDC while running; do not depend on simultaneous K5Viewer or UV Studio traffic.
- Host support for the prototype is macOS Chrome/Edge over `localhost`; Safari/mobile/cross-platform packaging are out of scope.
- No custom main-firmware build, community submission, cloud service, account system, or transmit control.
- All host protocol integers are little-endian; all incoming lengths, frequency values, bin counts, CRCs, and message versions are validated before use.

## Review Focus

- Fragmented, concatenated, corrupt, or garbage-prefixed serial bytes must resynchronize without stale data reaching the model — covered by Task 2 parser tests.
- A host that opens the port but stops reading or sending heartbeats must not block scanning or leave the receiver retuned — covered by Task 6 timeout/state-machine tests.
- Center/span combinations near receiver-region boundaries and the 630–840 MHz hole must be clamped or rejected safely — covered by Task 5 grid tests.
- Rendering must remain bounded during long sessions and browser resize/hidden-tab events — covered by Task 4 model/history tests and Task 7 browser smoke checks.
- Exit, USB loss, invalid commands, and monitor cancellation must restore saved receiver registers and audio state — covered by Task 6 host-harness tests.

---

## Planned File Structure

```text
spectrumlink/
├── README.md
├── package.json
├── docs/
│   └── superpowers/{specs,plans}/...
├── protocol/
│   ├── spectrumlink_protocol.h
│   └── protocol.md
├── radio/
│   └── spectrumlink/
│       ├── app.ld
│       ├── build.sh
│       ├── spectrumlink_app.c
│       └── test/
│           ├── host_api.c
│           ├── host_api.h
│           └── test_radio.py
├── web/
│   ├── index.html
│   ├── styles.css
│   └── src/
│       ├── app.js
│       ├── crc16.js
│       ├── history.js
│       ├── protocol.js
│       ├── render-2d.js
│       ├── render-3d.js
│       ├── render-waterfall.js
│       ├── serial-link.js
│       └── simulator.js
├── tests/web/
│   ├── crc16.test.mjs
│   ├── history.test.mjs
│   ├── protocol.test.mjs
│   └── serial-link.test.mjs
├── scripts/
│   ├── build-app.sh
│   ├── fetch-f4hwn.sh
│   └── serve.mjs
└── dist/
    └── .gitkeep
```

Generated upstream sources live under ignored `.cache/f4hwn-v6.3.0/`; generated `SpectrumLink.app` and browser bundles live under `dist/`.

### Task 1: Project Foundation and Pinned Upstream Build

**Files:**
- Create: `.gitignore`
- Create: `README.md`
- Create: `package.json`
- Create: `scripts/fetch-f4hwn.sh`
- Create: `scripts/build-app.sh`
- Create: `dist/.gitkeep`

**Interfaces:**
- Consumes: F4HWN source archive `https://codeload.github.com/armel/uv-k1-k5v3-firmware-custom/tar.gz/refs/tags/v6.3.0`, SHA-256 `2ceed535522113e7d86307a9b80d0f112bc4e55aa9fb6c65caacac8423a011d9`.
- Produces: `npm test`, `npm run serve`, `npm run build:app`; `.cache/f4hwn-v6.3.0/`; `dist/SpectrumLink.app` when radio sources exist.

- [ ] **Step 1: Create the repository metadata and scripts**

Define `package.json` scripts `test: node --test tests/web/*.test.mjs`, `serve: node scripts/serve.mjs`, and `build:app: bash scripts/build-app.sh`. Ignore `.cache/`, generated radio `.elf/.bin/.map/.app`, and `dist/*` except `.gitkeep`.

- [ ] **Step 2: Implement the pinned fetch script**

`scripts/fetch-f4hwn.sh` must download tag `v6.3.0`, verify the exact SHA-256 above, extract atomically to `.cache/f4hwn-v6.3.0`, and become a no-op when the verified tree already exists.

- [ ] **Step 3: Implement the overlay build wrapper**

`scripts/build-app.sh` must call the fetch script, replace only `.cache/f4hwn-v6.3.0/App/apps/spectrumlink/` with `radio/spectrumlink/`, run `./compile-app.sh spectrumlink`, and copy `build/Apps/SpectrumLink.app` to `dist/`.

After copying the radio directory, also copy `protocol/spectrumlink_protocol.h` into the cached `App/apps/spectrumlink/` directory so the generated build tree is self-contained without duplicating the wire definitions in source control.

- [ ] **Step 4: Verify bootstrap behavior**

Run: `bash scripts/fetch-f4hwn.sh && test -f .cache/f4hwn-v6.3.0/App/apps/app_api.h`

Expected: exit `0`; a second run performs no download; `APP_API_LEVEL` in the cached header is `3`.

- [ ] **Step 5: Initialize Git and commit**

```bash
git init
git add .gitignore README.md package.json scripts dist/.gitkeep docs
git commit -m "chore: bootstrap SpectrumLink prototype"
```

### Task 2: Versioned Binary Protocol and Browser Stream Parser

**Files:**
- Create: `protocol/spectrumlink_protocol.h`
- Create: `protocol/protocol.md`
- Create: `web/src/crc16.js`
- Create: `web/src/protocol.js`
- Create: `tests/web/crc16.test.mjs`
- Create: `tests/web/protocol.test.mjs`

**Interfaces:**
- Consumes: arbitrary `Uint8Array` chunks from Web Serial.
- Produces: `crc16Ccitt(bytes: Uint8Array): number`; `encodeFrame(type: number, sequence: number, payload: Uint8Array): Uint8Array`; class `FrameParser` with `push(chunk: Uint8Array): Frame[]`; `decodeSweep(frame: Frame): SweepFrame`.
- Wire constants shared with C: magic `SLNK`, version `1`, maximum payload `192`, CRC-16/CCITT-FALSE, message IDs `HELLO=0x01`, `SWEEP=0x02`, `STATUS=0x03`, `SET_CENTER=0x80`, `SET_SPAN=0x81`, `PAUSE=0x82`, `RESUME=0x83`, `MONITOR=0x84`, `STOP_MONITOR=0x85`, `PING=0x86`, `PONG=0x87`.

- [ ] **Step 1: Write failing CRC and frame tests**

Test the standard CCITT-FALSE vector `"123456789" -> 0x29B1`, exact little-endian header fields, valid SWEEP decoding, rejected bin counts other than `64`, payloads over `192`, unsupported version, and bad CRC.

- [ ] **Step 2: Run tests and confirm failure**

Run: `npm test`

Expected: FAIL because `web/src/crc16.js` and `web/src/protocol.js` do not exist.

- [ ] **Step 3: Implement CRC, frame encoding, and typed decoding**

Define the header as magic `[4]`, version `u8`, type `u8`, payload length `u16`, sequence `u16`; append CRC `u16` over header+payload. Define SWEEP payload as center `u32` in 10 Hz units, step `u16` in 10 Hz units, bin count `u8`, peak index `u8`, flags `u8`, reserved `u8`, then 64 signed dBm bytes.

- [ ] **Step 4: Add resynchronization tests and parser implementation**

Test one-byte fragmentation, random chunk boundaries, multiple frames per chunk, garbage before magic, a corrupt frame followed by a valid frame, and a false partial magic suffix carried to the next `push()`.

- [ ] **Step 5: Run tests and commit**

Run: `npm test`

Expected: all protocol and CRC tests PASS.

```bash
git add protocol web/src/crc16.js web/src/protocol.js tests/web
git commit -m "feat: define SpectrumLink USB protocol"
```

### Task 3: Serial Session and Simulation Source

**Files:**
- Create: `web/src/serial-link.js`
- Create: `web/src/simulator.js`
- Create: `tests/web/serial-link.test.mjs`

**Interfaces:**
- Consumes: `FrameParser`, Web Serial-compatible port object, or simulator mode.
- Produces: class `SerialLink` with `connect()`, `disconnect()`, `send(type, payload)`, and callbacks `onFrame`, `onState`, `onError`; class `SweepSimulator` with `start(onSweep)`, `stop()`, `setCenter()`, `setSpan()`.

- [ ] **Step 1: Write failing serial-session tests**

Use fake readable/writable streams to assert request/open, fragmented input delivery, serialized writes, HELLO-before-ready, `PING` every 500 ms, disconnect cleanup, read failure reporting, and no reconnect loop after an explicit disconnect.

- [ ] **Step 2: Run the focused test and confirm failure**

Run: `node --test tests/web/serial-link.test.mjs`

Expected: FAIL because `SerialLink` is missing.

- [ ] **Step 3: Implement `SerialLink`**

Inject `serialProvider` and timer functions so tests do not require a browser. Treat a valid HELLO as ready; keep port selection user-initiated; never silently select or open a device.

- [ ] **Step 4: Implement and test the simulator**

Generate deterministic 64-bin frames containing a moving narrow carrier, a wider FM-like mound, changing floor noise, and occasional dropouts. Verify sequence monotonicity, legal signed dBm, and exact center/step metadata.

- [ ] **Step 5: Run tests and commit**

Run: `npm test`

Expected: all tests PASS.

```bash
git add web/src/serial-link.js web/src/simulator.js tests/web/serial-link.test.mjs
git commit -m "feat: add serial session and spectrum simulator"
```

### Task 4: Bounded Spectrum History Model

**Files:**
- Create: `web/src/history.js`
- Create: `tests/web/history.test.mjs`

**Interfaces:**
- Consumes: decoded `SweepFrame` objects.
- Produces: class `SpectrumHistory` with `append(sweep)`, `clear()`, `setDepth(depth)`, `latest`, `rows`, `peakHold`, and normalized-color helpers; maximum allowed depth `256`.

- [ ] **Step 1: Write failing history/model tests**

Assert 64-bin validation, ring-buffer ordering, depth truncation, hard cap at `256`, reset on center/step change, peak-hold attack and decay, dBm clamp to `-128..0`, and no mutation of source frames.

- [ ] **Step 2: Run the focused test and confirm failure**

Run: `node --test tests/web/history.test.mjs`

Expected: FAIL because `SpectrumHistory` is missing.

- [ ] **Step 3: Implement the bounded model**

Use preallocated typed arrays per row and expose read-only iteration order from oldest to newest. Keep display smoothing and peak-hold state outside protocol objects.

- [ ] **Step 4: Add long-session and visibility-gap tests**

Append 100,000 synthetic sweeps and assert row count never exceeds depth, memory-owning row count stays bounded, and a sequence gap increments a diagnostic counter without inserting fake rows.

- [ ] **Step 5: Run tests and commit**

Run: `npm test`

Expected: all tests PASS.

```bash
git add web/src/history.js tests/web/history.test.mjs
git commit -m "feat: add bounded spectrum history model"
```

### Task 5: Radio Scan Core with Host Harness

**Files:**
- Create: `radio/spectrumlink/app.ld`
- Create: `radio/spectrumlink/build.sh`
- Create: `radio/spectrumlink/spectrumlink_app.c`
- Create: `radio/spectrumlink/test/host_api.h`
- Create: `radio/spectrumlink/test/host_api.c`
- Create: `radio/spectrumlink/test/test_radio.py`

**Interfaces:**
- Consumes: F4HWN v6.3.0 `app_api_t`, BK4829 registers, current RX VFO frequency.
- Produces: overlay entry `void app_main(const app_api_t *api)`; internal pure helpers `grid_for(center, span_index, Grid*)`, `encode_sweep(...)`, and receiver save/restore behavior exercised through the host harness.

- [ ] **Step 1: Create the failing host harness tests**

Compile `spectrumlink_app.c` for the host with a mocked `app_api_t`. Assert 64 ascending bins for all four spans using the deterministic half-open grid `center - span/2 + i*(span/64)` for `i=0..63`, 10 Hz-unit rounding, safe rejection/clamping at supported-region edges and the 630–840 MHz hole, stale-first-RSSI discard, corrected dBm capture, and correct peak index. With this convention bin 32 is the selected center frequency and the omitted upper endpoint prevents a 65th sample.

- [ ] **Step 2: Run the harness and confirm failure**

Run: `python3 radio/spectrumlink/test/test_radio.py`

Expected: FAIL because radio source and grid functions do not exist.

- [ ] **Step 3: Implement the minimal scan core**

Port only the necessary v6.3.0 Spectrum3D patterns: save registers, fixed-gain sweep setup, safe frequency-region logic, 64-bin retune/settle/read loop, peak tracking, and normal-register restoration. Do not port 3D drawing or persistent settings.

- [ ] **Step 4: Implement the compact radio screen**

Render `SPECT LINK`, USB state, center/span, peak frequency/dBm, and activity indicator. Implement `M` pause/resume, UV-K1 navigation center change, `3`/`F+3` span change, `EXIT` restore/quit, and explicit PTT ignore.

- [ ] **Step 5: Define build metadata and enforce size/capabilities**

Set `APP_NAME="SpectrumLink"`, `APP_VER="0.1"`, `APP_API_MIN=3`, VMA `0x20000280`, `--shortcut none`, and `--require serial`. Fail the build above `4096` bytes.

- [ ] **Step 6: Run harness tests and commit**

Run: `python3 radio/spectrumlink/test/test_radio.py`

Expected: all scan/grid/receiver tests PASS under Apple Clang.

```bash
git add radio/spectrumlink protocol/spectrumlink_protocol.h
git commit -m "feat: add UV-K1 SpectrumLink scan core"
```

### Task 6: Radio USB Transport, Commands, Monitoring, and Recovery

**Files:**
- Modify: `radio/spectrumlink/spectrumlink_app.c`
- Modify: `radio/spectrumlink/test/host_api.c`
- Modify: `radio/spectrumlink/test/test_radio.py`

**Interfaces:**
- Consumes: Task 2 wire protocol and Task 5 scan core.
- Produces: HELLO/SWEEP/STATUS/PONG output, bounded command parser, two-second host heartbeat state machine, monitoring state, receiver restoration guarantees.

- [ ] **Step 1: Add failing transport/state tests**

Assert HELLO fields, SWEEP byte-for-byte compatibility with browser fixtures, writes split into at most 64-byte chunks, corrupt/oversized/unknown command rejection, partial and concatenated command parsing, `APP_SERIAL_LOST` handling, and continued scanning after a dropped write.

- [ ] **Step 2: Add failing recovery and monitor tests**

Assert two seconds without valid PING restores the original frequency/bandwidth/audio and enters `USB LOST`; a new HELLO/PING handshake resumes scanning; MONITOR reuses saved modulation/bandwidth/squelch/audio, STOP_MONITOR resumes sweep, and EXIT restores exactly once from every state.

- [ ] **Step 3: Implement USB framing and command polling**

Poll `serial_read` often enough to stay below the API's 256-byte receive-ring limit. Use `serial_ctl(APP_SERIAL_USB, 0)` for host/loss/timeout events. Never wait indefinitely for `serial_write`; count and expose dropped frames.

- [ ] **Step 4: Implement monitor and safe-wait states**

Monitoring continues until STOP_MONITOR, center/span change, USB loss, or EXIT. USB loss restores the receiver and leaves the overlay app open with `USB LOST`; a valid handshake starts a fresh sweep.

- [ ] **Step 5: Run radio tests and commit**

Run: `python3 radio/spectrumlink/test/test_radio.py`

Expected: all radio protocol, timeout, monitor, and restoration tests PASS.

```bash
git add radio/spectrumlink
git commit -m "feat: stream sweeps over USB with safe recovery"
```

### Task 7: Browser Interface and Three Synchronized Renderers

**Files:**
- Create: `web/index.html`
- Create: `web/styles.css`
- Create: `web/src/render-2d.js`
- Create: `web/src/render-waterfall.js`
- Create: `web/src/render-3d.js`
- Create: `web/src/app.js`
- Create: `scripts/serve.mjs`

**Interfaces:**
- Consumes: `SerialLink`, `SweepSimulator`, `SpectrumHistory`.
- Produces: local page at `http://127.0.0.1:8765`, connection controls, synchronized canvases, host commands, screenshot export, diagnostics panel.

- [ ] **Step 1: Build the semantic page shell and state controller**

Create controls for Connect, Demo, Disconnect, Pause, center-frequency input/nudge, four spans, history depth, color gain, vertical scale, auto-scale, peak hold, Monitor, Stop Monitor, Clear, Screenshot, and Export Diagnostics. Disable radio-only controls until a valid HELLO.

- [ ] **Step 2: Implement the 2D and waterfall renderers**

Expose `renderSpectrum2D(ctx, history, view)` and `renderWaterfall(ctx, history, palette)`. Draw frequency labels from center/step metadata, current and held peaks, and blue→cyan→yellow→red→white intensity mapping.

- [ ] **Step 3: Implement the perspective 3D renderer**

Expose `renderSpectrum3D(ctx, history, view)`. Project bounded history rows back-to-front with configurable yaw/pitch-like perspective, consistent color mapping, frequency floor grid, and selected-frequency marker. Use Canvas 2D so no external runtime dependency is required.

- [ ] **Step 4: Wire interactions and safe retuning**

Pointer movement only updates a local cursor. Clicking selects a bin; only pressing Monitor sends `MONITOR`. Span/center commands show pending state until a matching SWEEP arrives. Pause stops radio sweeps in live mode and only rendering in demo mode.

- [ ] **Step 5: Add resize, hidden-tab, and screenshot behavior**

Use `ResizeObserver`; cap device-pixel scaling; stop animation frames while hidden but keep only bounded incoming history; resume with the latest state. Export a composed PNG containing all three views and metadata.

Export Diagnostics downloads JSON containing protocol/app identity, browser information, connection transitions, sequence gaps, CRC/parser errors, dropped-frame/status counters, current center/span, and the most recent 32 decoded sweep summaries; never include unrelated serial bytes or user files.

- [ ] **Step 6: Run automated and browser smoke checks**

Run: `npm test && npm run serve`

Expected: tests PASS; Chrome opens the page; Demo displays moving synchronized views; repeated resize/visibility changes do not grow history beyond its limit; unsupported browsers show a Web Serial compatibility message while Demo remains usable.

- [ ] **Step 7: Commit**

```bash
git add web scripts/serve.mjs package.json
git commit -m "feat: add color spectrum web visualizer"
```

### Task 8: Package, Validate, and Prepare User Hardware Test

**Files:**
- Modify: `README.md`
- Create: `docs/install-and-test-zh.md`
- Create: `docs/protocol-diagnostics.md`
- Create: `scripts/verify-dist.sh`
- Create: `start.command`
- Generate: `dist/SpectrumLink.app`

**Interfaces:**
- Consumes: complete radio/web implementation.
- Produces: installable `.app`, one-click macOS launcher, Chinese test guide, diagnostic export instructions.

- [ ] **Step 1: Build the radio artifact with the pinned toolchain**

Run: `npm run build:app`

Expected: Docker builds F4HWN v6.3.0 overlay; output reports no overflow; `dist/SpectrumLink.app` exists.

- [ ] **Step 2: Implement and run distribution verification**

`scripts/verify-dist.sh` must inspect the `.app` header and assert name `SpectrumLink`, API minimum `3`, capability `APP_CAP_SERIAL`, VMA `0x20000280`, code size `<=4096`, and non-empty checksum-valid artifact.

Run: `bash scripts/verify-dist.sh`

Expected: every assertion prints PASS and the script exits `0`.

- [ ] **Step 3: Write the macOS launcher and Chinese guide**

`start.command` changes to its own directory, starts the localhost server, opens Chrome/Edge URL, and terminates cleanly on Ctrl-C. The guide covers backup, UV Studio local `.app` installation, `F+7 -> SpectrumLink`, browser connection, Demo mode, expected first handshake, safe unplug/EXIT tests, and artifact removal.

- [ ] **Step 4: Run the complete pre-hardware verification**

Run:

```bash
npm test
python3 radio/spectrumlink/test/test_radio.py
npm run build:app
bash scripts/verify-dist.sh
```

Expected: all tests PASS; build stays within 4 KiB; verified `.app` is present.

- [ ] **Step 5: Perform user-assisted hardware acceptance**

Guide the user through install and launch. Record actual sweep rate, HELLO/API identity, peak comparison with built-in F4HWN spectrum, span changes, monitoring audio, USB unplug/replug, and EXIT restoration. Export diagnostics for any failed observation before changing scan timing.

- [ ] **Step 6: Commit the release candidate**

```bash
git add README.md docs scripts start.command dist/SpectrumLink.app
git commit -m "release: package SpectrumLink prototype"
```

## Completion Gate

Do not claim the prototype complete until Tasks 1–8 automated checks pass and the user confirms on physical hardware that install, live sweeps, monitor/stop, USB-loss recovery, and EXIT restoration behave as specified. A passing simulator alone is not completion.

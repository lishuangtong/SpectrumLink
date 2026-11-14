# SpectrumLink Prototype Design

## Intent

Build a local prototype that lets the user's Quansheng UV-K1 running F4HWN Labs v6.3.0 act as the RF scanner while a Mac browser renders a large, color spectrum, waterfall, and perspective 3D ridge display. The first milestone is successful operation on the user's own radio, not community publication.

## Goals

- Install a standalone `SpectrumLink.app` through UV Studio without replacing the Labs main firmware.
- Sweep 64 frequency points around the selected receive VFO and stream calibrated signal levels over the UV-K1 native USB-C serial connection.
- Connect from Chrome or Edge using Web Serial.
- Render three synchronized views: 2D spectrum, color waterfall, and perspective 3D history.
- Show center frequency, span, frequency step, peak frequency, and peak level.
- Allow pause/resume, span selection, peak hold, display scaling, and local screenshots.
- Allow a clicked frequency or detected peak to be monitored by the radio while the app is running.
- Restore the normal receiver state when the overlay app exits or the cable disconnects.

## Non-goals

- No replacement of the UV-K1 monochrome LCD or attempt to display full color on the radio.
- No I/Q sampling, FFT, or claim that the UV-K1 becomes a true wideband SDR. The display visualizes sequential RSSI measurements.
- No transmission support. The prototype is receive-only and must never key PTT.
- No modification or reflashing of the F4HWN Labs main firmware for the first version.
- No UV Studio catalog submission, public release, automatic updater, account system, or cloud backend.
- No promise of Safari, Firefox, mobile, Windows, or Linux support in the first prototype.

## Constraints and confirmed platform capabilities

- Target radio: Quansheng UV-K1 / UV-K1(8), with the user's current F4HWN Labs v6.3.0 installation.
- Pin the prototype build to the upstream F4HWN `v6.3.0` release tag, including that tag's `app_api.h`, Spectrum3D, KISS TNC, linker script pattern, metadata tools, and documented build toolchain. Do not build against rolling `main` unless the installed firmware is also changed.
- F4HWN overlay apps execute from external Flash in a constrained overlay and use the v6.3 application API.
- API level 3 exposes corrected RSSI, BK4829 register access, the current receive frequency, receiver-state helpers, and `serial_read` / `serial_write` / `serial_ctl` for native USB-C CDC.
- Once an overlay app starts using the serial API, the resident command parser and K5Viewer release the USB port until the app exits. UV Studio screen mirroring is therefore unavailable while SpectrumLink is active.
- The existing Spectrum3D implementation proves that a 64-point sweep and receiver restoration fit within the overlay-app constraints. The KISS TNC app proves bidirectional host communication over the overlay serial API.
- Web Serial requires a supported desktop Chromium browser and a secure context. The prototype will run from localhost rather than depending on `file://` behavior.

## Approaches considered

### 1. Independent Labs app plus browser visualizer — selected

The overlay app owns scanning and sends compact numeric sweep packets. A local browser app owns rendering and interaction.

Tradeoffs: no main-firmware flashing and clean failure recovery, but K5Viewer cannot share the USB port while the app runs. The `.app` must match the installed Labs API version.

### 2. Recolor the existing K5Viewer screen stream

This avoids a new radio app, but provides only 1-bit framebuffer differences rather than raw RSSI bins. Frequency and level reconstruction would be fragile, and the resulting 3D history would be a visual approximation.

Rejected because it does not meet the user's goal of a meaningful large spectrum display.

### 3. Add a spectrum packet to the resident K5Viewer protocol

This could integrate deeply with normal radio screens and offer excellent host performance, but requires a custom Labs firmware build and reflashing the main firmware.

Rejected for the first prototype because it adds unnecessary recovery and upgrade risk.

## Radio application design

The radio component will be a new F4HWN v6.3 overlay app named `SpectrumLink` and built as a `.app` file using the upstream overlay build pattern.

It will borrow only the minimum proven scanning and receiver-restoration patterns from the upstream Spectrum3D app:

- Save the active receive frequency, bandwidth, modulation-related receiver state, and relevant BK4829 registers on entry.
- Generate a 64-bin frequency grid around the selected VFO.
- Support the same four total sweep widths as the official Spectrum3D app: `400 kHz`, `800 kHz`, `1.6 MHz`, and `3.2 MHz` (equivalently `±200 kHz` through `±1.6 MHz`). Calculate the 64-point grid in the radio's 10 Hz frequency units, round each point to a valid synthesizer value, and clamp/reject grids that cross unsupported receiver regions.
- Tune sequentially, allow RF settling, discard a stale first RSSI read when required, and record corrected dBm values.
- Track peak bin and peak level.
- Poll USB commands between measurements so controls remain responsive.
- On exit, error, or disconnect, restore saved receiver settings before returning to Labs.

Signal levels mean the corrected dBm values returned by the F4HWN application API. The prototype does not claim laboratory-grade absolute calibration or a fixed tolerance across individual radios.

The radio screen will remain intentionally simple:

- title: `SPECT LINK`
- USB state: waiting / connected / lost
- center frequency and selected span
- current peak frequency and dBm
- sweep counter or activity indicator
- `M`: pause/resume
- navigation keys: adjust center frequency
- `3` / `F+3`: narrower/wider span
- `EXIT`: restore radio state and quit

The app will ignore PTT and contain no transmit path.

## USB protocol

The link will use a small versioned binary protocol designed for resynchronization after dropped or partial USB reads.

Each message contains:

- four-byte magic: `SLNK`
- protocol version
- message type
- payload length
- sequence number
- payload
- CRC-16

Initial message types:

- `HELLO`: radio/app/API identity and supported features
- `SWEEP`: center frequency, bin step, bin count, 64 signed dBm values, peak index, flags
- `STATUS`: paused/listening/USB state and recoverable error code
- `SET_CENTER`: host requests a new center frequency
- `SET_SPAN`: host selects one of the supported spans
- `PAUSE` / `RESUME`
- `MONITOR`: host requests temporary receive monitoring at a selected bin/frequency
- `STOP_MONITOR`: resume sweeping
- `PING` / `PONG`

RSSI will use signed 8-bit dBm values because the useful range fits within `-128..0`, keeping each complete sweep compact. USB writes will be divided into endpoint-friendly chunks, following the existing KISS TNC pattern. The parser will reject invalid lengths, unsupported versions, bad CRCs, and out-of-range frequencies.

## Browser application design

The computer component will be a dependency-light local web application served on `localhost` and opened in Chrome or Edge.

Primary layout:

- top status row: connect/disconnect, radio/app version, center, span, step, sweep rate
- main large perspective 3D spectrum history, styled like the user's reference image with blue noise floor and cyan/yellow/red/white peak coloring
- synchronized 2D spectrum trace with current peak and peak-hold markers
- scrolling waterfall history
- compact controls for pause, span, history depth, color gain, vertical scale, auto-scale, and screenshot

Rendering will use browser Canvas/WebGL capabilities without a server-side data processor. The radio supplies measured bins; the computer performs interpolation, smoothing, coloring, perspective projection, history storage, and rendering.

Clicking or dragging on the frequency axis will select a bin. A deliberate `Monitor` action will send the request to the radio; simple pointer movement will never retune it. The page will visibly distinguish sweeping, paused, and monitoring states.

Monitoring reuses the receive modulation, bandwidth, squelch, and audio configuration that was active when SpectrumLink started. It continues until `STOP_MONITOR`, a new center/span command, USB-loss recovery, or app exit. The first prototype will not add separate host controls for modulation or bandwidth.

For the prototype, a small local launcher will start the static server and open the page. A simulation mode will generate repeatable synthetic sweeps so the visualizer and parser can be tested without occupying the radio.

## Failure handling and safety

- USB disconnect: a lost host-state indication or two seconds without a valid host `PING` stops scanning, restores the normal receiver, and shows `USB LOST`. The overlay app remains open in a safe waiting state. A new valid host handshake may restart scanning without relaunching the app; `EXIT` always returns to Labs.
- Corrupt or partial packet: browser scans for the next `SLNK` magic and records an error counter without crashing.
- Host stops reading: bounded USB writes may be dropped; the radio continues scanning and reports a drop counter rather than blocking RF operation indefinitely.
- Unsupported app/API version: show a clear incompatibility message and refuse to scan.
- Invalid host frequency or span: reject it on the radio; never write unchecked values to receiver registers.
- Exiting the overlay app always runs receiver restoration.
- No transmit APIs or PTT handling are included.

## Testing and verification

### Host-only tests

- Binary protocol encode/decode, partial reads, concatenated frames, CRC failures, and resynchronization.
- Simulation-mode rendering at multiple sweep rates and history depths.
- Browser disconnect/reconnect behavior.
- Screenshot output and control-state persistence.

### Radio build checks

- Compile with the same v6.3 overlay ABI and size constraints as the installed Labs firmware.
- Confirm `.app` metadata and UV Studio local installation validation.
- Confirm no transmit capability or transmit callback is linked.

### User-assisted hardware acceptance

Because the physical UV-K1 remains with the user, final acceptance is interactive:

1. Back up current radio configuration/calibration as a precaution.
2. Install the local `.app` through UV Studio.
3. Launch `F+7 -> SpectrumLink`.
4. Connect the browser and verify HELLO/STATUS.
5. Compare displayed peaks with the radio's built-in spectrum analyzer.
6. Test span changes, pause, monitoring, USB unplug/replug, and `EXIT` restoration.
7. Collect the browser diagnostic log if tuning or RSSI behavior differs on the user's hardware revision.

## Prototype acceptance criteria

- UV Studio accepts and installs `SpectrumLink.app` on the user's Labs v6.3.0 radio.
- The browser connects through USB-C and receives continuously increasing sweep sequence numbers.
- All 64 bins render in synchronized 2D, waterfall, and 3D views.
- Frequency labels and the reported peak correspond to the radio's configured center/span.
- At least two complete sweeps per second are sustained in the baseline configuration; higher rates are an optimization, not a gate.
- Selecting Monitor causes receive audio at the requested frequency and Stop/Exit resumes or restores normal operation.
- Disconnecting USB or exiting the app does not leave the receiver on a temporary scan frequency.

## Deliverables

- `SpectrumLink.app`
- radio-app source and reproducible build instructions
- local browser application with simulation mode
- macOS-friendly launcher
- concise install/test guide for the user's UV-K1
- diagnostic log export for hardware testing

## Builder decisions left open

The implementer may choose the exact directory structure, CRC-16 variant, rendering implementation, visual interpolation algorithm, and test framework, provided the protocol is versioned and the safety/acceptance requirements above are preserved.

# RF Activity Enhancement Design

## Goal

Turn the K1's 64-point RSSI sweeps into honest, useful activity cues without implying that speech audio has been decoded and without adding another dashboard module.

## Approved interface

- The connection area gains a compact `RX ACTIVE` state with frequency, S/dBm and elapsed duration.
- The existing live spectrum labels the three strongest separated peaks.
- The existing waterfall overlays recent RF event markers that can be inspected.
- The existing Recent QSO module gains `最近通联 / RF 事件` tabs. QSO records remain editable; RF events are automatic and read-only.
- Detection sensitivity lives in the settings drawer and defaults to 12 dB above the adaptive noise floor.

## Detection rules

- Estimate noise floor from the lower-middle sweep percentile rather than the strongest bins.
- A candidate must exceed `noise floor + sensitivity` in two consecutive sweeps.
- Release is delayed by 500 ms to avoid chatter.
- A completed event records start time, end time, peak frequency, peak dBm and duration.
- Labels say `RX ACTIVE`, `信号活动`, or `RF 事件`; never `正在讲话`.

## Layout constraints

- Preserve the existing three-column dashboard and every existing chart.
- Do not add a standalone module.
- Keep the QSO tab as the default and preserve manual QSO editing.
- Keep all additions usable in the current iPad-width and wide-monitor layouts.


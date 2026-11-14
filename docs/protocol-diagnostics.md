# Protocol and diagnostics

SpectrumLink uses protocol version 1 as documented in `protocol/protocol.md`.
The radio sends HELLO, SWEEP, STATUS, and PONG messages; the host sends center,
span, pause, resume, monitor, stop-monitor, and heartbeat commands. Radio
writes are split into chunks no larger than 64 bytes.

The browser diagnostic export contains only SpectrumLink state: app/API
identity, browser identity, connection transitions, parser counters, sequence
gaps, current geometry, and summaries of the latest 32 sweeps. It does not
capture arbitrary serial traffic or read unrelated files. A CRC error means a
frame was discarded and parsing resumed at the next `SLNK` magic. A sequence
gap means at least one valid sweep did not reach the history model.


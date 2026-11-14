# SpectrumLink USB protocol v1

Every frame begins with ASCII `SLNK`, followed by version and type bytes,
little-endian payload length and sequence fields, the payload, and a
little-endian CRC-16/CCITT-FALSE over the header and payload. The initial CRC
value is `0xffff`, the polynomial is `0x1021`, and there is no reflection or
final XOR. Payloads larger than 192 bytes are invalid.

Frequencies use unsigned 10 Hz units on the wire. A sweep contains 64 signed
8-bit corrected dBm readings. The complete sweep payload is 74 bytes:
`center_10hz:u32`, `step_10hz:u16`, `bin_count:u8`, `peak_index:u8`,
`flags:u8`, `reserved:u8`, then 64 `int8` readings.

Receivers must tolerate fragmented and concatenated frames. After malformed
input they scan for the next `SLNK` magic and must not expose a frame until its
version, length, and CRC have all been validated.

HELLO is exactly six bytes: ABI major, API level, bin count, span bit mask,
application major, and application minor. STATUS is exactly eight bytes:
mode, flags, dropped-frame count `u16`, parser CRC-error count `u16`, and
parser length/version-error count `u16`. SWEEP uses its own sequence counter so
HELLO, PONG, and STATUS traffic cannot create false sweep-gap diagnostics.


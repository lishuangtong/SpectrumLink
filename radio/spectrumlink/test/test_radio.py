#!/usr/bin/env python3
import pathlib
import shutil
import struct
import subprocess
import tempfile

HERE = pathlib.Path(__file__).resolve().parent
APP = HERE.parent
CC = shutil.which("clang") or shutil.which("gcc")
if not CC:
    raise SystemExit("clang or gcc is required")

with tempfile.TemporaryDirectory() as tmp:
    exe = pathlib.Path(tmp) / "spectrumlink-host"
    subprocess.run([
        CC, "-std=c11", "-O2", "-Wall", "-Wextra", "-Werror",
        "-DSPECTRUMLINK_HOST_TEST", "-I", str(HERE),
        str(APP / "spectrumlink_app.c"), str(HERE / "host_api.c"),
        "-o", str(exe),
    ], check=True)

    def run(*args):
        return subprocess.run([str(exe), *map(str, args)], check=True,
                              capture_output=True, text=True).stdout.strip().split()

    spans = [625, 1250, 2500, 5000]
    center = 14_550_000
    for index, step in enumerate(spans):
        ok, actual_center, first, actual_step, last = map(int, run("grid", center, index))
        assert ok == 1
        assert actual_center == center
        assert actual_step == step
        assert first == center - 32 * step
        assert last == first + 63 * step

    low = list(map(int, run("grid", 1_800_100, 3)))
    assert low == [1, 1_960_000, 1_800_000, 5_000, 2_115_000]

    near_hole = list(map(int, run("grid", 62_990_000, 3)))
    assert near_hole[0] == 1
    assert near_hole[4] <= 62_999_999
    assert near_hole[1] == near_hole[2] + 32 * near_hole[3]

    assert run("grid", 70_000_000, 0)[0] == "0"
    assert run("grid", center, 4)[0] == "0"

    tune, glitch, stale, rssi, peak, last_tuned, peak_dbm = map(int, run("scan"))
    assert (tune, glitch, stale, rssi) == (64, 64, 64, 64)
    assert peak == 17 and peak_dbm == -40
    assert last_tuned == center - 32 * spans[0] + 63 * spans[0]

    frequency, bandwidth, control, writes, agc_off, agc_on, audio_off, audio_on, af_calls, last_af = map(int, run("restore"))
    assert (frequency, bandwidth, control) == (14_550_000, 0x1234, 0x5678)
    assert writes >= 3 and (agc_off, agc_on, audio_off, audio_on) == (1, 1, 2, 1)
    assert af_calls == 1 and last_af == 1

    assert tuple(map(int, run("snapshot"))) == (0, 0, 0, 0, 14_550_000)
    parked, writes, agc_off, audio_off, af_calls, last_af = map(int, run("monitorstop"))
    assert parked == 14_530_000 and writes >= 1
    assert (agc_off, audio_off, af_calls, last_af) == (1, 1, 1, 0)

    assert tuple(map(int, run("chunks"))) == (1, 3, 64)
    assert tuple(map(int, run("chunks", "fail"))) == (0, 2, 64)

    def crc16(data):
        crc = 0xFFFF
        for byte in data:
            crc ^= byte << 8
            for _ in range(8):
                crc = ((crc << 1) ^ 0x1021) & 0xFFFF if crc & 0x8000 else (crc << 1) & 0xFFFF
        return crc

    levels = bytes(((-120 + i) & 0xFF) for i in range(64))
    payload = struct.pack("<I HBBBB", 14_550_000, 625, 64, 11, 5, 0) + levels
    header = b"SLNK" + struct.pack("<BBHH", 1, 2, len(payload), 9)
    expected = header + payload + struct.pack("<H", crc16(header + payload))
    assert bytes.fromhex(run("frame")[0]) == expected

    count, msg_type, sequence, crc_errors, length_errors = map(int, run("parse"))
    assert (count, msg_type, sequence) == (1, 0x87, 11)
    assert (crc_errors, length_errors) == (1, 0)

    acquires, restores, mode, owned = map(int, run("session"))
    assert (acquires, restores, mode, owned) == (2, 2, 0, 0)

print("ALL PASS")


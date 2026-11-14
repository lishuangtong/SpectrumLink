#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "host_api.h"

static unsigned tune_count, glitch_reads, stale_reads, rssi_reads;
static unsigned write_count, agc_off, agc_on, audio_off, audio_on, af_calls;
static uint32_t last_tuned;
static uint8_t last_af;
static unsigned chunk_calls, chunk_max;
static bool chunk_fail_second;

static void tune(uint32_t frequency) { tune_count++; last_tuned = frequency; }
static uint16_t read_reg(uint8_t reg) {
    if (reg == 0x63u) { glitch_reads++; return 0; }
    if (reg == 0x67u) { stale_reads++; return 0; }
    if (reg == 0x43u) return 0x1234u;
    if (reg == 0x30u) return 0x5678u;
    return 0;
}
static void write_reg(uint8_t reg, uint16_t value) { (void)reg; (void)value; write_count++; }
static int16_t rssi_dbm(void) {
    const unsigned index = rssi_reads++;
    return index == 17u ? -40 : (int16_t)(-120 + (int)(index % 9u));
}
static void delay_ms(uint16_t milliseconds) { (void)milliseconds; }
static void set_agc(bool enabled) { if (enabled) agc_on++; else agc_off++; }
static void audio_path(bool enabled) { if (enabled) audio_on++; else audio_off++; }
static void set_af(uint8_t mode) { af_calls++; last_af = mode; }
static uint32_t rx_freq(void) { return 14550000u; }
static bool chunk_writer(const uint8_t *data, uint16_t length) {
    (void)data; chunk_calls++; if (length > chunk_max) chunk_max = length;
    return !(chunk_fail_second && chunk_calls == 2u);
}

static const sl_radio_ops_t ops = {
    tune, read_reg, write_reg, rssi_dbm, delay_ms, set_agc, audio_path, set_af, rx_freq
};

int main(int argc, char **argv) {
    if (argc < 2) return 2;
    if (strcmp(argv[1], "grid") == 0) {
        if (argc != 4) return 2;
        sl_grid_t grid = {0};
        const bool ok = sl_grid_for((uint32_t)strtoul(argv[2], NULL, 10),
                                    (uint8_t)strtoul(argv[3], NULL, 10), &grid);
        printf("%u %u %u %u %u\n", ok, grid.center, grid.first, grid.step, grid.last);
        return 0;
    }
    if (strcmp(argv[1], "scan") == 0) {
        sl_grid_t grid;
        int8_t bins[SL_BINS];
        uint8_t peak = 0;
        if (!sl_grid_for(14550000u, 0, &grid)) return 3;
        sl_scan_sweep(&ops, &grid, bins, &peak);
        printf("%u %u %u %u %u %u %d\n", tune_count, glitch_reads, stale_reads,
               rssi_reads, peak, last_tuned, bins[peak]);
        return 0;
    }
    if (strcmp(argv[1], "restore") == 0) {
        sl_receiver_state_t state;
        sl_receiver_begin(&ops, &state);
        sl_receiver_restore(&ops, &state);
        printf("%u %u %u %u %u %u %u %u %u %u\n", state.frequency, state.bandwidth,
               state.control, write_count, agc_off, agc_on, audio_off, audio_on, af_calls, last_af);
        return 0;
    }
    if (strcmp(argv[1], "snapshot") == 0) {
        sl_receiver_state_t state = {0};
        sl_receiver_snapshot(&ops, &state);
        printf("%u %u %u %u %u\n", write_count, agc_off, audio_off, af_calls, state.frequency);
        return 0;
    }
    if (strcmp(argv[1], "monitorstop") == 0) {
        sl_monitor_stop(&ops, 14530000u);
        printf("%u %u %u %u %u %u\n", last_tuned, write_count, agc_off, audio_off, af_calls, last_af);
        return 0;
    }
    if (strcmp(argv[1], "chunks") == 0) {
        uint8_t data[150] = {0};
        chunk_fail_second = argc > 2;
        const bool ok = sl_write_chunks(chunk_writer, data, sizeof(data));
        printf("%u %u %u\n", ok, chunk_calls, chunk_max);
        return 0;
    }
    if (strcmp(argv[1], "frame") == 0) {
        int8_t levels[64];
        for (unsigned i = 0; i < 64u; i++) levels[i] = (int8_t)(-120 + (int)i);
        uint8_t payload[74] = {0}, output[SL_MAX_FRAME];
        payload[0] = 0xf0; payload[1] = 0x03; payload[2] = 0xde; payload[3] = 0x00;
        payload[4] = 0x71; payload[5] = 0x02; payload[6] = 64; payload[7] = 11; payload[8] = 5;
        memcpy(payload + 10, levels, 64);
        const uint16_t length = sl_encode_frame(2, 9, payload, sizeof(payload), output, sizeof(output));
        for (uint16_t i = 0; i < length; i++) printf("%02x", output[i]);
        putchar('\n');
        return 0;
    }
    if (strcmp(argv[1], "parse") == 0) {
        uint8_t first[SL_MAX_FRAME], second[SL_MAX_FRAME], stream[2 * SL_MAX_FRAME + 3];
        uint8_t one = 1, two = 2;
        uint16_t a = sl_encode_frame(3, 10, &one, 1, first, sizeof(first));
        uint16_t b = sl_encode_frame(0x87, 11, &two, 1, second, sizeof(second));
        first[10] ^= 0x40;
        stream[0] = 0xaa; stream[1] = 0x53; stream[2] = 0x00;
        memcpy(stream + 3, first, a); memcpy(stream + 3 + a, second, b);
        sl_parser_t parser = {0}; sl_frame_t frames[2];
        uint8_t count = 0;
        count += sl_parser_feed(&parser, stream, 5, frames, 2);
        count += sl_parser_feed(&parser, stream + 5, (uint16_t)(3 + a + b - 5), frames + count, (uint8_t)(2 - count));
        printf("%u %u %u %u %u\n", count, count ? frames[0].type : 0,
               count ? frames[0].sequence : 0, parser.crc_errors, parser.length_errors);
        return 0;
    }
    if (strcmp(argv[1], "session") == 0) {
        sl_session_t session = {0};
        unsigned restores = 0, acquires = 0;
        acquires += sl_session_ping(&session, 100u) == SL_ACTION_ACQUIRE;
        sl_session_set_mode(&session, SL_MODE_MONITOR);
        restores += sl_session_tick(&session, 2099u) == SL_ACTION_RESTORE;
        restores += sl_session_tick(&session, 2100u) == SL_ACTION_RESTORE;
        restores += sl_session_tick(&session, 5000u) == SL_ACTION_RESTORE;
        acquires += sl_session_ping(&session, 5100u) == SL_ACTION_ACQUIRE;
        sl_session_set_mode(&session, SL_MODE_MONITOR);
        sl_session_set_mode(&session, SL_MODE_SCAN);
        restores += sl_session_host_lost(&session) == SL_ACTION_RESTORE;
        restores += sl_session_host_lost(&session) == SL_ACTION_RESTORE;
        printf("%u %u %u %u\n", acquires, restores, session.mode, session.receiver_owned);
        return 0;
    }
    return 2;
}


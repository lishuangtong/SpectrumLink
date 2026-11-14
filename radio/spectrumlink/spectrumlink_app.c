/* SpectrumLink — receive-only 64-bin scanner for F4HWN Labs v6.3.0. */
#include <stdbool.h>
#include <stdint.h>

#ifdef SPECTRUMLINK_HOST_TEST
#include "test/host_api.h"
#else
#include "../app_api.h"
#include "spectrumlink_protocol.h"
#define SL_BINS 64u
typedef struct {
    uint32_t center, first;
    uint16_t step;
    uint32_t last;
} sl_grid_t;
typedef struct {
    void (*tune)(uint32_t);
    uint16_t (*read_reg)(uint8_t);
    void (*write_reg)(uint8_t, uint16_t);
    int16_t (*rssi_dbm)(void);
    void (*delay_ms)(uint16_t);
    void (*set_agc)(bool);
    void (*audio_path)(bool);
    void (*set_af)(uint8_t);
    uint32_t (*rx_freq)(void);
} sl_radio_ops_t;
typedef struct {
    uint32_t frequency;
    uint16_t bandwidth, control;
    uint8_t af_mode;
    bool audio_enabled;
} sl_receiver_state_t;
#define SL_MAX_FRAME 204u
typedef struct {
    uint8_t buffer[SL_MAX_FRAME];
    uint16_t length, crc_errors, length_errors;
} sl_parser_t;
typedef struct { uint8_t type; uint16_t sequence, payload_length; uint8_t payload[192]; } sl_frame_t;
enum { SL_MODE_SAFE = 0, SL_MODE_SCAN = 1, SL_MODE_PAUSED = 2, SL_MODE_MONITOR = 3 };
enum { SL_ACTION_NONE = 0, SL_ACTION_ACQUIRE = 1, SL_ACTION_RESTORE = 2 };
typedef struct { uint32_t last_ping; uint8_t mode; bool receiver_owned; } sl_session_t;
#endif

#define REG_CTRL   0x30u
#define REG_FREQ_LO 0x38u
#define REG_FREQ_HI 0x39u
#define REG_RX_BW  0x43u
#define REG_GLITCH 0x63u
#define REG_RSSI   0x67u
#define WIDE_BW    0x3628u
#define CTRL_AF_DAC (1u << 9)

static const uint16_t span_steps[4] = {625u, 1250u, 2500u, 5000u};
static const uint32_t regions[3][2] = {
    {1800000u, 27999999u},
    {28000000u, 62999999u},
    {84000000u, 130000000u},
};

uint16_t sl_crc16(const uint8_t *data, uint16_t length)
{
    uint16_t crc = 0xffffu;
    while (length--) {
        crc ^= (uint16_t)*data++ << 8;
        for (uint8_t bit = 0; bit < 8u; bit++)
            crc = (uint16_t)((crc & 0x8000u) ? ((uint32_t)crc << 1) ^ 0x1021u : (uint32_t)crc << 1);
    }
    return crc;
}

uint16_t sl_encode_frame(uint8_t type, uint16_t sequence, const void *payload,
                         uint16_t payload_length, uint8_t *output, uint16_t capacity)
{
    const uint16_t total = (uint16_t)(12u + payload_length);
    if (payload_length > 192u || capacity < total)
        return 0;
    output[0] = 'S'; output[1] = 'L'; output[2] = 'N'; output[3] = 'K';
    output[4] = 1u; output[5] = type;
    output[6] = (uint8_t)payload_length; output[7] = (uint8_t)(payload_length >> 8);
    output[8] = (uint8_t)sequence; output[9] = (uint8_t)(sequence >> 8);
    const uint8_t *source = payload;
    for (uint16_t i = 0; i < payload_length; i++) output[10u + i] = source[i];
    const uint16_t crc = sl_crc16(output, (uint16_t)(10u + payload_length));
    output[10u + payload_length] = (uint8_t)crc;
    output[11u + payload_length] = (uint8_t)(crc >> 8);
    return total;
}

static bool sl_magic(const uint8_t *buffer)
{
    return buffer[0] == 'S' && buffer[1] == 'L' && buffer[2] == 'N' && buffer[3] == 'K';
}

static void sl_shift(sl_parser_t *parser)
{
    for (uint16_t i = 1; i < parser->length; i++) parser->buffer[i - 1u] = parser->buffer[i];
    if (parser->length) parser->length--;
}

uint8_t sl_parser_feed(sl_parser_t *parser, const uint8_t *data, uint16_t length,
                       sl_frame_t *frames, uint8_t frame_capacity)
{
    uint8_t count = 0;
    while (length--) {
        if (parser->length == SL_MAX_FRAME) {
            sl_shift(parser);
            parser->length_errors++;
        }
        parser->buffer[parser->length++] = *data++;
        while (parser->length >= 4u && !sl_magic(parser->buffer)) sl_shift(parser);
        if (parser->length < 10u) continue;
        const uint16_t payload_length = (uint16_t)(parser->buffer[6] | ((uint16_t)parser->buffer[7] << 8));
        if (parser->buffer[4] != 1u || payload_length > 192u) {
            parser->length_errors++;
            sl_shift(parser);
            continue;
        }
        const uint16_t total = (uint16_t)(12u + payload_length);
        if (parser->length < total) continue;
        const uint16_t expected = (uint16_t)(parser->buffer[10u + payload_length] |
                                  ((uint16_t)parser->buffer[11u + payload_length] << 8));
        if (sl_crc16(parser->buffer, (uint16_t)(10u + payload_length)) != expected) {
            parser->crc_errors++;
            sl_shift(parser);
            continue;
        }
        if (count < frame_capacity) {
            sl_frame_t *frame = &frames[count++];
            frame->type = parser->buffer[5];
            frame->sequence = (uint16_t)(parser->buffer[8] | ((uint16_t)parser->buffer[9] << 8));
            frame->payload_length = payload_length;
            for (uint16_t i = 0; i < payload_length; i++) frame->payload[i] = parser->buffer[10u + i];
        }
        parser->length = 0;
    }
    return count;
}

uint8_t sl_session_ping(sl_session_t *session, uint32_t now)
{
    session->last_ping = now;
    if (session->receiver_owned) return SL_ACTION_NONE;
    session->receiver_owned = true;
    session->mode = SL_MODE_SCAN;
    return SL_ACTION_ACQUIRE;
}

uint8_t sl_session_tick(sl_session_t *session, uint32_t now)
{
    if (!session->receiver_owned || (uint32_t)(now - session->last_ping) < 2000u)
        return SL_ACTION_NONE;
    session->receiver_owned = false;
    session->mode = SL_MODE_SAFE;
    return SL_ACTION_RESTORE;
}

uint8_t sl_session_host_lost(sl_session_t *session)
{
    if (!session->receiver_owned) return SL_ACTION_NONE;
    session->receiver_owned = false;
    session->mode = SL_MODE_SAFE;
    return SL_ACTION_RESTORE;
}

void sl_session_set_mode(sl_session_t *session, uint8_t mode)
{
    if (session->receiver_owned && mode <= SL_MODE_MONITOR) session->mode = mode;
}

bool sl_grid_for(uint32_t center, uint8_t span_index, sl_grid_t *grid)
{
    if (!grid || span_index >= 4u)
        return false;
    uint32_t lo = 0, hi = 0;
    for (uint8_t i = 0; i < 3u; i++)
        if (center >= regions[i][0] && center <= regions[i][1]) {
            lo = regions[i][0];
            hi = regions[i][1];
            break;
        }
    if (!lo)
        return false;
    const uint16_t step = span_steps[span_index];
    const uint32_t width = 63u * (uint32_t)step;
    uint32_t first = center > 32u * (uint32_t)step ? center - 32u * (uint32_t)step : lo;
    if (first < lo)
        first = lo;
    if (first > hi - width)
        first = hi - width;
    grid->first = first;
    grid->step = step;
    grid->last = first + width;
    grid->center = first + 32u * (uint32_t)step;
    return true;
}

void sl_scan_sweep(const sl_radio_ops_t *ops, const sl_grid_t *grid,
                   int8_t bins[SL_BINS], uint8_t *peak_index)
{
    int8_t peak = -128;
    *peak_index = 0;
    for (uint8_t i = 0; i < SL_BINS; i++) {
        ops->tune(grid->first + (uint32_t)i * grid->step);
        ops->delay_ms(1u);
        for (uint8_t guard = 50u; guard && (ops->read_reg(REG_GLITCH) & 0xffu) >= 200u; guard--)
            ;
        (void)ops->read_reg(REG_RSSI);      /* discard the stale first sample */
        int16_t dbm = ops->rssi_dbm();
        if (dbm < -128) dbm = -128;
        if (dbm > 0) dbm = 0;
        bins[i] = (int8_t)dbm;
        if (bins[i] > peak) {
            peak = bins[i];
            *peak_index = i;
        }
    }
}

void sl_receiver_snapshot(const sl_radio_ops_t *ops, sl_receiver_state_t *state)
{
    state->frequency = ops->rx_freq();
    state->bandwidth = ops->read_reg(REG_RX_BW);
    state->control = ops->read_reg(REG_CTRL);
    state->af_mode = 1u;
    state->audio_enabled = true;
}

void sl_receiver_acquire(const sl_radio_ops_t *ops)
{
    ops->audio_path(false);
    ops->set_agc(false);
    ops->write_reg(REG_RX_BW, WIDE_BW);
}

void sl_receiver_begin(const sl_radio_ops_t *ops, sl_receiver_state_t *state)
{
    sl_receiver_snapshot(ops, state);
    sl_receiver_acquire(ops);
}

void sl_receiver_restore(const sl_radio_ops_t *ops, const sl_receiver_state_t *state)
{
    ops->audio_path(false);
    ops->set_agc(true);
    ops->write_reg(REG_RX_BW, state->bandwidth);
    ops->tune(state->frequency);
    ops->write_reg(REG_CTRL, state->control);
    ops->set_af(state->af_mode);
    ops->audio_path(state->audio_enabled);
}

void sl_monitor_stop(const sl_radio_ops_t *ops, uint32_t park_frequency)
{
    ops->set_af(0u);
    ops->audio_path(false);
    ops->set_agc(false);
    ops->write_reg(REG_RX_BW, WIDE_BW);
    ops->tune(park_frequency);
}

bool sl_write_chunks(bool (*writer)(const uint8_t *, uint16_t), const uint8_t *data, uint16_t length)
{
    for (uint16_t offset = 0; offset < length; offset += 64u) {
        const uint16_t remaining = (uint16_t)(length - offset);
        const uint16_t chunk = remaining > 64u ? 64u : remaining;
        if (!writer(data + offset, chunk)) return false;
    }
    return true;
}

#ifndef SPECTRUMLINK_HOST_TEST
static const app_api_t *A;
static uint16_t scan_control;
static uint16_t tx_sequence, sweep_sequence, dropped_frames;
static app_beam_channel_t saved_channel;

void *memset(void *destination, int value, unsigned size)
{
    uint8_t *out = destination;
    while (size--) *out++ = (uint8_t)value;
    return destination;
}

void *memcpy(void *destination, const void *source, unsigned size)
{
    uint8_t *out = destination;
    const uint8_t *in = source;
    while (size--) *out++ = *in++;
    return destination;
}

static void radio_tune(uint32_t frequency)
{
    A->bk_write(REG_FREQ_LO, (uint16_t)frequency);
    A->bk_write(REG_FREQ_HI, (uint16_t)(frequency >> 16));
    A->bk_write(REG_CTRL, 0);
    A->bk_write(REG_CTRL, scan_control);
}
static uint16_t radio_read(uint8_t reg) { return A->bk_read(reg); }
static void radio_write(uint8_t reg, uint16_t value) { A->bk_write(reg, value); }
static int16_t radio_rssi(void) { return A->rssi_dbm(); }
static void radio_delay(uint16_t ms) { A->delay_ms(ms); }
static void radio_agc(bool on) { A->set_agc(on); }
static void radio_audio(bool on) { A->audio_path(on); }
static void radio_af(uint8_t mode) { A->set_af(mode); }
static uint32_t radio_frequency(void) { return A->rx_freq(); }

static const sl_radio_ops_t radio_ops = {
    radio_tune, radio_read, radio_write, radio_rssi, radio_delay,
    radio_agc, radio_audio, radio_af, radio_frequency
};

static bool serial_writer(const uint8_t *data, uint16_t length)
{
    return A->serial_write(APP_SERIAL_USB, data, length);
}

static bool send_packet(uint8_t type, uint16_t sequence, const void *payload, uint16_t payload_length)
{
    uint8_t frame[SL_MAX_FRAME];
    const uint16_t length = sl_encode_frame(type, sequence, payload, payload_length,
                                            frame, sizeof(frame));
    if (!length) return false;
    if (!sl_write_chunks(serial_writer, frame, length)) {
        dropped_frames++;
        return false;
    }
    return true;
}

static bool send_frame(uint8_t type, const void *payload, uint16_t payload_length)
{
    return send_packet(type, tx_sequence++, payload, payload_length);
}

static void send_hello(void)
{
    const uint8_t hello[6] = {APP_ABI_MAJOR, APP_API_LEVEL, SL_BINS, 0x0fu, 0u, 1u};
    (void)send_frame(SL_MSG_HELLO, hello, sizeof(hello));
}

static void send_sweep(const sl_grid_t *grid, const int8_t bins[SL_BINS], uint8_t peak)
{
    sl_sweep_payload_t payload;
    payload.center_10hz = grid->center;
    payload.step_10hz = grid->step;
    payload.bin_count = SL_BINS;
    payload.peak_index = peak;
    payload.flags = 1u;
    payload.reserved = 0;
    for (uint8_t i = 0; i < SL_BINS; i++) payload.dbm[i] = bins[i];
    (void)send_packet(SL_MSG_SWEEP, sweep_sequence++, &payload, sizeof(payload));
}

static void send_status(const sl_parser_t *parser, uint8_t mode, uint8_t flags)
{
    uint8_t payload[8];
    payload[0] = mode; payload[1] = flags;
    payload[2] = (uint8_t)dropped_frames; payload[3] = (uint8_t)(dropped_frames >> 8);
    payload[4] = (uint8_t)parser->crc_errors; payload[5] = (uint8_t)(parser->crc_errors >> 8);
    payload[6] = (uint8_t)parser->length_errors; payload[7] = (uint8_t)(parser->length_errors >> 8);
    (void)send_frame(SL_MSG_STATUS, payload, sizeof(payload));
}

static uint32_t read_u32(const uint8_t *p)
{
    return (uint32_t)p[0] | ((uint32_t)p[1] << 8) |
           ((uint32_t)p[2] << 16) | ((uint32_t)p[3] << 24);
}

static void start_monitor(const sl_receiver_state_t *saved, uint32_t frequency)
{
    A->set_af(APP_AF_MUTE);
    A->audio_path(false);
    A->set_agc(true);
    A->bk_write(REG_RX_BW, saved->bandwidth);
    radio_tune(frequency);
    A->bk_write(REG_CTRL, (uint16_t)(saved->control | CTRL_AF_DAC));
    A->audio_path(true);
    A->delay_ms(60u);
    A->set_af(saved_channel.modulation == 0u ? APP_AF_FM : APP_AF_AM);
}

static void stop_monitor(const sl_grid_t *grid)
{
    sl_monitor_stop(&radio_ops, grid->first);
}

static char *copy_text(char *out, const char *text)
{
    while (*text) *out++ = *text++;
    return out;
}

static void draw_screen(const sl_grid_t *grid, const int8_t bins[SL_BINS],
                        uint8_t peak, uint8_t mode, bool host, uint32_t sweeps)
{
    char line[28], *out;
    A->display_clear();
    A->print_bold("SPECT LINK", 0, 127, 0);
    out = copy_text(line, host ? "USB LINK  #" : "USB LOST  #");
    out = A->append_u32(out, sweeps); *out = 0;
    A->print_normal(line, 0, 127, 1);
    out = copy_text(line, "C "); out = A->append_u32(out, grid->center); out = copy_text(out, " x10Hz"); *out = 0;
    A->print_normal(line, 0, 127, 2);
    out = copy_text(line, "SPAN "); out = A->append_u32(out, (uint32_t)grid->step * 64u * 10u); out = copy_text(out, " Hz"); *out = 0;
    A->print_normal(line, 0, 127, 3);
    out = copy_text(line, "PEAK "); out = A->append_i32(out, bins[peak]); out = copy_text(out, " dBm"); *out = 0;
    A->print_normal(line, 0, 127, 4);
    A->print_normal(mode == SL_MODE_MONITOR ? "MONITOR MENU STOP" :
                    mode == SL_MODE_PAUSED ? "MENU RESUME  EXIT" : "MENU PAUSE   EXIT", 0, 127, 5);
    A->blit_page(8u);
}

__attribute__((section(".text.entry"), used))
void app_main(const app_api_t *api)
{
    A = api;
    sl_receiver_state_t saved;
    sl_grid_t grid;
    sl_parser_t parser = {0};
    sl_session_t session = {0};
    int8_t bins[SL_BINS] = {0};
    uint8_t peak = 0, span = 0, previous = APP_KEY_INVALID;
    bool running = true, f_armed = false, host = false;
    uint32_t center = api->rx_freq(), sweeps = 0;

    scan_control = api->bk_read(REG_CTRL) & (uint16_t)~CTRL_AF_DAC;
    if (api->beam_get) api->beam_get(&saved_channel);
    sl_receiver_snapshot(&radio_ops, &saved);
    saved.af_mode = saved_channel.modulation == 0u ? APP_AF_FM : APP_AF_AM;
    saved.audio_enabled = true;
    api->backlight_on();
    (void)sl_grid_for(center, span, &grid);

    while (running) {
        const uint8_t serial_state = api->serial_ctl(APP_SERIAL_USB, 0);
        const bool new_host = (serial_state & APP_SERIAL_HOST) != 0;
        if (serial_state & APP_SERIAL_ENUM) parser.length = 0;
        if (new_host && !host) {
            parser.length = 0;
            send_hello();
            send_status(&parser, session.mode, 1u);
        }
        host = new_host;
        if (!host || (serial_state & APP_SERIAL_LOST)) {
            parser.length = 0;
            if (sl_session_host_lost(&session) == SL_ACTION_RESTORE)
                sl_receiver_restore(&radio_ops, &saved);
        }
        uint8_t incoming[96];
        const uint16_t incoming_length = api->serial_read(APP_SERIAL_USB, incoming, sizeof(incoming));
        sl_frame_t frames[2];
        const uint8_t frame_count = sl_parser_feed(&parser, incoming, incoming_length, frames, 2u);
        for (uint8_t i = 0; i < frame_count; i++) {
            sl_frame_t *frame = &frames[i];
            if (frame->type == SL_MSG_PING && frame->payload_length == 0u) {
                if (sl_session_ping(&session, api->ticks_ms()) == SL_ACTION_ACQUIRE) {
                    sl_receiver_acquire(&radio_ops);
                }
                (void)send_frame(SL_MSG_PONG, 0, 0);
            } else if (!session.receiver_owned) {
                continue;
            } else if (frame->type == SL_MSG_SET_CENTER && frame->payload_length == 4u) {
                sl_grid_t requested;
                const uint32_t value = read_u32(frame->payload);
                if (sl_grid_for(value, span, &requested)) {
                    if (session.mode == SL_MODE_MONITOR) stop_monitor(&grid);
                    grid = requested; center = grid.center;
                    sl_session_set_mode(&session, SL_MODE_SCAN);
                }
            } else if (frame->type == SL_MSG_SET_SPAN && frame->payload_length == 1u && frame->payload[0] < 4u) {
                sl_grid_t requested;
                if (sl_grid_for(center, frame->payload[0], &requested)) {
                    if (session.mode == SL_MODE_MONITOR) stop_monitor(&grid);
                    span = frame->payload[0]; grid = requested; center = grid.center;
                    sl_session_set_mode(&session, SL_MODE_SCAN);
                }
            } else if (frame->type == SL_MSG_PAUSE && frame->payload_length == 0u) {
                if (session.mode == SL_MODE_MONITOR) stop_monitor(&grid);
                sl_session_set_mode(&session, SL_MODE_PAUSED);
            } else if (frame->type == SL_MSG_RESUME && frame->payload_length == 0u) {
                if (session.mode == SL_MODE_MONITOR) stop_monitor(&grid);
                sl_session_set_mode(&session, SL_MODE_SCAN);
            } else if (frame->type == SL_MSG_MONITOR && frame->payload_length == 4u) {
                sl_grid_t valid;
                const uint32_t frequency = read_u32(frame->payload);
                if (sl_grid_for(frequency, 0u, &valid)) {
                    start_monitor(&saved, frequency);
                    sl_session_set_mode(&session, SL_MODE_MONITOR);
                }
            } else if (frame->type == SL_MSG_STOP_MONITOR && frame->payload_length == 0u) {
                if (session.mode == SL_MODE_MONITOR) stop_monitor(&grid);
                sl_session_set_mode(&session, SL_MODE_SCAN);
            }
        }
        if (sl_session_tick(&session, api->ticks_ms()) == SL_ACTION_RESTORE) {
            sl_receiver_restore(&radio_ops, &saved);
            if (host) send_status(&parser, session.mode, 2u);
        }

        const uint8_t key = api->get_key();
        if (key != previous && key != APP_KEY_INVALID) {
            const int8_t nav = api->nav_dir(key);
            if (key == APP_KEY_EXIT) running = false;
            else if (key == APP_KEY_MENU && session.receiver_owned) {
                if (session.mode == SL_MODE_MONITOR) stop_monitor(&grid);
                sl_session_set_mode(&session, session.mode == SL_MODE_PAUSED ? SL_MODE_SCAN : SL_MODE_PAUSED);
            }
            else if (key == APP_KEY_F) f_armed = true;
            else if (key == APP_KEY_3) {
                if (session.mode == SL_MODE_MONITOR) stop_monitor(&grid);
                if (f_armed && span) span--;
                else if (!f_armed && span < 3u) span++;
                f_armed = false;
                (void)sl_grid_for(center, span, &grid);
                sl_session_set_mode(&session, SL_MODE_SCAN);
            } else if (nav) {
                if (session.mode == SL_MODE_MONITOR) stop_monitor(&grid);
                center = nav > 0 ? center + grid.step : center - grid.step;
                (void)sl_grid_for(center, span, &grid);
                center = grid.center;
                sl_session_set_mode(&session, SL_MODE_SCAN);
                f_armed = false;
            } else if (key != APP_KEY_PTT) f_armed = false;
        }
        previous = key;
        if (!running) break;
        if (session.mode == SL_MODE_SCAN) {
            sl_scan_sweep(&radio_ops, &grid, bins, &peak);
            sweeps++;
            send_sweep(&grid, bins, peak);
            if ((sweeps & 7u) == 0u) send_status(&parser, session.mode, 1u);
        } else {
            api->delay_ms(20);
        }
        draw_screen(&grid, bins, peak, session.mode, host, sweeps);
        api->backlight_update();
    }
    api->set_af(APP_AF_MUTE);
    if (sl_session_host_lost(&session) == SL_ACTION_RESTORE)
        sl_receiver_restore(&radio_ops, &saved);
}
#endif


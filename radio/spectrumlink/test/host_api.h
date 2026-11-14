#ifndef SPECTRUMLINK_HOST_API_H
#define SPECTRUMLINK_HOST_API_H

#include <stdbool.h>
#include <stdint.h>

#define SL_BINS 64u

typedef struct {
    uint32_t center;
    uint32_t first;
    uint16_t step;
    uint32_t last;
} sl_grid_t;

typedef struct {
    void (*tune)(uint32_t frequency);
    uint16_t (*read_reg)(uint8_t reg);
    void (*write_reg)(uint8_t reg, uint16_t value);
    int16_t (*rssi_dbm)(void);
    void (*delay_ms)(uint16_t milliseconds);
    void (*set_agc)(bool enabled);
    void (*audio_path)(bool enabled);
    void (*set_af)(uint8_t mode);
    uint32_t (*rx_freq)(void);
} sl_radio_ops_t;

typedef struct {
    uint32_t frequency;
    uint16_t bandwidth;
    uint16_t control;
    uint8_t af_mode;
    bool audio_enabled;
} sl_receiver_state_t;

#define SL_MAX_FRAME 204u
typedef struct {
    uint8_t buffer[SL_MAX_FRAME];
    uint16_t length;
    uint16_t crc_errors;
    uint16_t length_errors;
} sl_parser_t;
typedef struct { uint8_t type; uint16_t sequence, payload_length; uint8_t payload[192]; } sl_frame_t;

enum { SL_MODE_SAFE = 0, SL_MODE_SCAN = 1, SL_MODE_PAUSED = 2, SL_MODE_MONITOR = 3 };
enum { SL_ACTION_NONE = 0, SL_ACTION_ACQUIRE = 1, SL_ACTION_RESTORE = 2 };
typedef struct { uint32_t last_ping; uint8_t mode; bool receiver_owned; } sl_session_t;

bool sl_grid_for(uint32_t center, uint8_t span_index, sl_grid_t *grid);
void sl_scan_sweep(const sl_radio_ops_t *ops, const sl_grid_t *grid,
                   int8_t bins[SL_BINS], uint8_t *peak_index);
void sl_receiver_begin(const sl_radio_ops_t *ops, sl_receiver_state_t *state);
void sl_receiver_snapshot(const sl_radio_ops_t *ops, sl_receiver_state_t *state);
void sl_receiver_acquire(const sl_radio_ops_t *ops);
void sl_receiver_restore(const sl_radio_ops_t *ops, const sl_receiver_state_t *state);
void sl_monitor_stop(const sl_radio_ops_t *ops, uint32_t park_frequency);
uint16_t sl_crc16(const uint8_t *data, uint16_t length);
uint16_t sl_encode_frame(uint8_t type, uint16_t sequence, const void *payload,
                         uint16_t payload_length, uint8_t *output, uint16_t capacity);
uint8_t sl_parser_feed(sl_parser_t *parser, const uint8_t *data, uint16_t length,
                       sl_frame_t *frames, uint8_t frame_capacity);
uint8_t sl_session_ping(sl_session_t *session, uint32_t now);
uint8_t sl_session_tick(sl_session_t *session, uint32_t now);
uint8_t sl_session_host_lost(sl_session_t *session);
void sl_session_set_mode(sl_session_t *session, uint8_t mode);
bool sl_write_chunks(bool (*writer)(const uint8_t *, uint16_t), const uint8_t *data, uint16_t length);

#endif


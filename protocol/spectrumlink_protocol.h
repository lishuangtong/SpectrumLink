#ifndef SPECTRUMLINK_PROTOCOL_H
#define SPECTRUMLINK_PROTOCOL_H

#include <stdint.h>

#define SL_PROTOCOL_VERSION 1u
#define SL_MAX_PAYLOAD 192u
#define SL_SWEEP_BINS 64u
#define SL_HEADER_SIZE 10u
#define SL_FRAME_OVERHEAD 12u

enum sl_message_type {
    SL_MSG_HELLO = 0x01,
    SL_MSG_SWEEP = 0x02,
    SL_MSG_STATUS = 0x03,
    SL_MSG_SET_CENTER = 0x80,
    SL_MSG_SET_SPAN = 0x81,
    SL_MSG_PAUSE = 0x82,
    SL_MSG_RESUME = 0x83,
    SL_MSG_MONITOR = 0x84,
    SL_MSG_STOP_MONITOR = 0x85,
    SL_MSG_PING = 0x86,
    SL_MSG_PONG = 0x87,
};

typedef struct __attribute__((packed)) {
    uint8_t magic[4];
    uint8_t version;
    uint8_t type;
    uint16_t payload_length;
    uint16_t sequence;
} sl_frame_header_t;

typedef struct __attribute__((packed)) {
    uint32_t center_10hz;
    uint16_t step_10hz;
    uint8_t bin_count;
    uint8_t peak_index;
    uint8_t flags;
    uint8_t reserved;
    int8_t dbm[SL_SWEEP_BINS];
} sl_sweep_payload_t;

#endif


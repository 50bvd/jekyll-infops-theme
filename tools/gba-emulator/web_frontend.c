/*
 * web_frontend.c — minimal libretro frontend for gpSP in the browser.
 *
 * gpSP (the GBA emulator of the GP2X / PSP scene) is built as a libretro core
 * with Emscripten; this file implements the frontend side of the libretro API
 * and exposes a tiny C API to JavaScript (assets/js/terminal-commands/gba.js):
 *
 *   gba_load(path)        load a ROM already written to the in-memory FS
 *   gba_run_frame()       emulate one frame (video + audio)
 *   gba_set_keys(mask)    joypad state (RETRO_DEVICE_ID_JOYPAD_* bitmask)
 *   gba_frame_ptr()       240×160 RGB565 frame of the last emulated frame
 *   gba_audio_ptr()/…     interleaved stereo int16 samples of the last frame
 *   gba_sram_ptr()/size() battery save memory (saved by JS in IndexedDB)
 *   gba_state_*()         save states
 *
 * Everything runs locally in the visitor's browser: the ROM never leaves it.
 * Licence: GPL-2.0 (same as gpSP).
 */
#include <stdbool.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#include <emscripten/emscripten.h>
#include "libretro.h"

#define W 240
#define H 160
#define AUDIO_MAX (4096 * 2)

static uint16_t frame[W * H];
static int16_t  audio[AUDIO_MAX];
static unsigned audio_len;          /* stereo frames written for the last frame */
static uint32_t keys;
static bool     loaded;
static uint8_t *state_buf;
static size_t   state_size;

/* Core options: defaults below, changed at run time by gba_set_option()
 * (settings panel); the core re-reads them on the next frame. */
static struct { const char *key; char value[16]; } options[] = {
   { "gpsp_bios",             "builtin"  },   /* open-source BIOS */
   { "gpsp_drc",              "disabled" },   /* no JIT in WebAssembly */
   { "gpsp_sound_rate",       "32768"    },
   { "gpsp_frameskip",        "disabled" },   /* "fixed_interval" when the core is too slow */
   { "gpsp_frameskip_interval", "0"      },   /* frames skipped between two drawn ones */
   { "gpsp_color_correction", "enabled"  },   /* GBA LCD colours */
   { "gpsp_frame_mixing",     "disabled" },   /* inter-frame blending */
   { "gpsp_boot_mode",        "game"     },
   { "gpsp_rtc_time_source",  "system"   },   /* cartridge clock = the PC's clock */
};
static bool options_updated;

static bool env_cb(unsigned cmd, void *data)
{
   switch (cmd)
   {
      case RETRO_ENVIRONMENT_GET_VARIABLE: {
         struct retro_variable *v = (struct retro_variable *)data;
         v->value = NULL;
         for (size_t i = 0; i < sizeof(options) / sizeof(options[0]); i++)
            if (!strcmp(v->key, options[i].key)) { v->value = options[i].value; break; }
         return v->value != NULL;
      }
      case RETRO_ENVIRONMENT_GET_VARIABLE_UPDATE:
         *(bool *)data = options_updated;
         options_updated = false;
         return true;
      case RETRO_ENVIRONMENT_SET_PIXEL_FORMAT:
         return *(const enum retro_pixel_format *)data == RETRO_PIXEL_FORMAT_RGB565;
      case RETRO_ENVIRONMENT_GET_SYSTEM_DIRECTORY:
         *(const char **)data = "/";
         return true;
      case RETRO_ENVIRONMENT_GET_INPUT_BITMASKS:
         return true;
      default:
         return false;
   }
}

/* gba_set_option("gpsp_color_correction", "disabled") */
EMSCRIPTEN_KEEPALIVE int gba_set_option(const char *key, const char *value)
{
   for (size_t i = 0; i < sizeof(options) / sizeof(options[0]); i++)
      if (!strcmp(key, options[i].key)) {
         strncpy(options[i].value, value, sizeof(options[i].value) - 1);
         options[i].value[sizeof(options[i].value) - 1] = 0;
         options_updated = true;
         return 1;
      }
   return 0;
}

static void video_cb(const void *data, unsigned w, unsigned h, size_t pitch)
{
   if (!data) return;                          /* duplicated frame: keep the last one */
   const uint8_t *src = (const uint8_t *)data;
   for (unsigned y = 0; y < h && y < H; y++)
      memcpy(frame + y * W, src + y * pitch, (w < W ? w : W) * 2);
}

static size_t audio_batch_cb(const int16_t *data, size_t frames)
{
   size_t room = AUDIO_MAX / 2 - audio_len;
   size_t n = frames < room ? frames : room;
   memcpy(audio + audio_len * 2, data, n * 4);
   audio_len += n;
   return frames;
}

static void audio_cb(int16_t l, int16_t r)
{
   int16_t s[2] = { l, r };
   audio_batch_cb(s, 1);
}

static void input_poll_cb(void) {}

static int16_t input_state_cb(unsigned port, unsigned device, unsigned index, unsigned id)
{
   if (port || device != RETRO_DEVICE_JOYPAD) return 0;
   if (id == RETRO_DEVICE_ID_JOYPAD_MASK) return (int16_t)keys;
   return (keys >> id) & 1;
}

EMSCRIPTEN_KEEPALIVE int gba_init(void)
{
   retro_set_environment(env_cb);
   retro_set_video_refresh(video_cb);
   retro_set_audio_sample(audio_cb);
   retro_set_audio_sample_batch(audio_batch_cb);
   retro_set_input_poll(input_poll_cb);
   retro_set_input_state(input_state_cb);
   retro_init();
   return 1;
}

EMSCRIPTEN_KEEPALIVE int gba_load(const char *path)
{
   if (loaded) { retro_unload_game(); loaded = false; }
   struct retro_game_info info = { path, NULL, 0, NULL };
   loaded = retro_load_game(&info);
   return loaded ? 1 : 0;
}

EMSCRIPTEN_KEEPALIVE void gba_run_frame(void)
{
   audio_len = 0;
   if (loaded) retro_run();
}

EMSCRIPTEN_KEEPALIVE void     gba_reset(void)            { if (loaded) retro_reset(); }
EMSCRIPTEN_KEEPALIVE void     gba_set_keys(uint32_t k)   { keys = k; }
EMSCRIPTEN_KEEPALIVE uint16_t *gba_frame_ptr(void)       { return frame; }
EMSCRIPTEN_KEEPALIVE int16_t  *gba_audio_ptr(void)       { return audio; }
EMSCRIPTEN_KEEPALIVE unsigned gba_audio_frames(void)     { return audio_len; }
EMSCRIPTEN_KEEPALIVE unsigned gba_sample_rate(void)
{
   struct retro_system_av_info av;
   retro_get_system_av_info(&av);
   return (unsigned)av.timing.sample_rate;
}
EMSCRIPTEN_KEEPALIVE double   gba_fps(void)
{
   struct retro_system_av_info av;
   retro_get_system_av_info(&av);
   return av.timing.fps;
}
EMSCRIPTEN_KEEPALIVE void    *gba_sram_ptr(void)  { return retro_get_memory_data(RETRO_MEMORY_SAVE_RAM); }
EMSCRIPTEN_KEEPALIVE size_t   gba_sram_size(void) { return retro_get_memory_size(RETRO_MEMORY_SAVE_RAM); }

/* Save states: gba_state_save() serialises into an internal buffer
 * (gba_state_ptr / gba_state_size), gba_state_load() reads it back. */
static bool state_alloc(void)
{
   size_t need = retro_serialize_size();
   if (!need) return false;
   if (need != state_size) { free(state_buf); state_buf = malloc(need); state_size = state_buf ? need : 0; }
   return state_buf != NULL;
}
EMSCRIPTEN_KEEPALIVE int      gba_state_save(void) { return loaded && state_alloc() && retro_serialize(state_buf, state_size); }
EMSCRIPTEN_KEEPALIVE int      gba_state_load(void) { return loaded && state_buf && retro_unserialize(state_buf, state_size); }
EMSCRIPTEN_KEEPALIVE uint8_t *gba_state_ptr(void)  { if (!state_buf) state_alloc(); return state_buf; }
EMSCRIPTEN_KEEPALIVE size_t   gba_state_size(void) { if (!state_buf) state_alloc(); return state_size; }

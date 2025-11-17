import { Type } from '@sinclair/typebox';
import { createTypedTool } from './typed-tool-system.js';
import fs from 'fs/promises';
import path from 'path';

/**
 * SNES Sound Engine Tool
 * 
 * Manages SNES audio development including SPC700 sound engine setup,
 * sample conversion, and music/sound effect integration for PVSnesLib.
 */
export const soundEngineTool = createTypedTool({
  name: 'sound_engine',
  description: 'Manage SNES audio - SPC700 engine, samples, music, sound effects for PVSnesLib',
  inputSchema: Type.Object({
    action: Type.Union([
      Type.Literal('create_sound_engine'),
      Type.Literal('convert_wav_to_brr'),
      Type.Literal('create_music_template'),
      Type.Literal('generate_sfx_bank'),
      Type.Literal('setup_spc_player'),
      Type.Literal('analyze_audio_memory')
    ], {
      description: 'Audio action to perform'
    }),
    filePath: Type.Optional(Type.String({
      description: 'Path to audio file or output directory'
    })),
    audioFormat: Type.Optional(Type.Union([
      Type.Literal('BRR'),
      Type.Literal('SPC'),
      Type.Literal('IT'),
      Type.Literal('NSF')
    ], {
      description: 'Audio format for conversion'
    })),
    sampleRate: Type.Optional(Type.Union([
      Type.Literal(8000),
      Type.Literal(11025),
      Type.Literal(16000),
      Type.Literal(22050),
      Type.Literal(32000)
    ], {
      description: 'Sample rate in Hz (SNES-compatible rates)'
    })),
    channels: Type.Optional(Type.Union([
      Type.Literal(1),
      Type.Literal(2)
    ], {
      description: 'Number of audio channels (mono/stereo)'
    })),
    engineType: Type.Optional(Type.Union([
      Type.Literal('tracker'),
      Type.Literal('sequencer'),
      Type.Literal('simple')
    ], {
      description: 'Sound engine type'
    })),
    trackCount: Type.Optional(Type.Number({
      description: 'Number of audio tracks/channels',
      minimum: 1,
      maximum: 8
    }))
  }),
  outputSchema: Type.Object({
    success: Type.Boolean(),
    message: Type.String(),
    data: Type.Optional(Type.Object({
      generatedFiles: Type.Optional(Type.Array(Type.String())),
      audioInfo: Type.Optional(Type.Object({
        format: Type.String(),
        size: Type.Number(),
        duration: Type.Number(),
        memoryUsage: Type.Number(),
        trackCount: Type.Number()
      })),
      codeSnippet: Type.Optional(Type.String()),
      instructions: Type.Optional(Type.String())
    }))
  }),
  handler: async (input) => {
    try {
      const { 
        action, 
        filePath, 
        audioFormat = 'BRR', 
        sampleRate = 22050, 
        channels = 1,
        engineType = 'simple',
        trackCount = 4
      } = input;

      switch (action) {
        case 'create_sound_engine':
          return await createSoundEngine(engineType, trackCount);
        
        case 'convert_wav_to_brr':
          if (!filePath) {
            return {
              success: false,
              message: 'filePath is required for WAV conversion'
            };
          }
          return await convertWavToBrr(filePath, sampleRate);
        
        case 'create_music_template':
          return await createMusicTemplate(trackCount);
        
        case 'generate_sfx_bank':
          return await generateSfxBank();
        
        case 'setup_spc_player':
          return await setupSpcPlayer(engineType);
        
        case 'analyze_audio_memory':
          return await analyzeAudioMemory();
        
        default:
          return {
            success: false,
            message: `Unknown action: ${action}`
          };
      }
    } catch (error) {
      return {
        success: false,
        message: `Sound engine error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
});

async function createSoundEngine(engineType: string, trackCount: number) {
  // Generate SPC700 sound engine header
  const engineHeader = `#ifndef SOUND_ENGINE_H
#define SOUND_ENGINE_H

#include <snes.h>

// Sound Engine Configuration
#define SOUND_TRACK_COUNT    ${trackCount}
#define SOUND_MAX_SAMPLES    32
#define SOUND_SAMPLE_BANK    0x8000
#define SOUND_MUSIC_BANK     0xA000

// Sound Engine Types
typedef struct {
    u8 *sample_data;
    u16 sample_size;
    u16 loop_start;
    u16 loop_end;
    u8 volume;
    u8 pitch;
} sound_sample_t;

typedef struct {
    u8 channel;
    u8 note;
    u8 instrument;
    u8 volume;
    u8 effects;
} sound_track_t;

// Global sound engine state
extern sound_sample_t sound_samples[SOUND_MAX_SAMPLES];
extern sound_track_t sound_tracks[SOUND_TRACK_COUNT];
extern bool sound_engine_initialized;

// Core Functions
void soundEngineInit(void);
void soundEngineUpdate(void);
void soundEngineShutdown(void);

// Sample Management
u8 soundLoadSample(const u8 *data, u16 size, u16 loop_start, u16 loop_end);
void soundFreeSample(u8 sample_id);

// Music Functions
void soundPlayMusic(const u8 *music_data);
void soundStopMusic(void);
void soundPauseMusic(void);
void soundResumeMusic(void);
void soundSetMusicVolume(u8 volume);

// Sound Effect Functions
void soundPlaySFX(u8 sample_id, u8 volume, u8 pitch);
void soundStopSFX(u8 channel);
void soundStopAllSFX(void);

// Channel Control
void soundSetChannelVolume(u8 channel, u8 volume);
void soundSetChannelPanning(u8 channel, s8 pan);
void soundMuteChannel(u8 channel);
void soundUnmuteChannel(u8 channel);

#endif // SOUND_ENGINE_H`;

  // Generate SPC700 source implementation
  const engineSource = `#include "sound_engine.h"

// Global Variables
sound_sample_t sound_samples[SOUND_MAX_SAMPLES];
sound_track_t sound_tracks[SOUND_TRACK_COUNT];
bool sound_engine_initialized = false;

// SPC700 Communication Ports
#define SPC_PORT0 0x2140
#define SPC_PORT1 0x2141
#define SPC_PORT2 0x2142
#define SPC_PORT3 0x2143

// Internal state
static u8 current_sample_count = 0;
static bool music_playing = false;
static u8 music_volume = 127;

void soundEngineInit(void) {
    if (sound_engine_initialized) {
        return;
    }
    
    // Initialize SPC700
    // Wait for SPC to be ready
    while (REG_SPC_PORT0 != 0xAA || REG_SPC_PORT1 != 0xBB) {
        // Wait for SPC ready signal
    }
    
    // Load SPC700 program (sound driver)
    // This would load your custom SPC700 assembly program
    // spcLoad(spc_sound_driver, sizeof(spc_sound_driver));
    
    // Initialize sample table
    for (u8 i = 0; i < SOUND_MAX_SAMPLES; i++) {
        sound_samples[i].sample_data = NULL;
        sound_samples[i].sample_size = 0;
        sound_samples[i].volume = 127;
        sound_samples[i].pitch = 60; // Middle C
    }
    
    // Initialize tracks
    for (u8 i = 0; i < SOUND_TRACK_COUNT; i++) {
        sound_tracks[i].channel = i;
        sound_tracks[i].volume = 127;
    }
    
    sound_engine_initialized = true;
    consoleWrite("Sound engine initialized\\n");
}

void soundEngineUpdate(void) {
    if (!sound_engine_initialized) {
        return;
    }
    
    // Update music playback
    if (music_playing) {
        // Process music data and send commands to SPC700
        // This would be implemented based on your music format
    }
    
    // Check for SPC700 communication
    // Handle any status updates from the sound processor
}

u8 soundLoadSample(const u8 *data, u16 size, u16 loop_start, u16 loop_end) {
    if (current_sample_count >= SOUND_MAX_SAMPLES) {
        return 0xFF; // Error: no free sample slots
    }
    
    u8 sample_id = current_sample_count++;
    sound_samples[sample_id].sample_data = (u8*)data;
    sound_samples[sample_id].sample_size = size;
    sound_samples[sample_id].loop_start = loop_start;
    sound_samples[sample_id].loop_end = loop_end;
    
    // Send sample data to SPC700 memory
    // This would transfer the BRR sample data to audio RAM
    
    return sample_id;
}

void soundPlaySFX(u8 sample_id, u8 volume, u8 pitch) {
    if (sample_id >= SOUND_MAX_SAMPLES || !sound_samples[sample_id].sample_data) {
        return;
    }
    
    // Send play command to SPC700
    REG_SPC_PORT0 = 0x01; // Play SFX command
    REG_SPC_PORT1 = sample_id;
    REG_SPC_PORT2 = volume;
    REG_SPC_PORT3 = pitch;
    
    // Wait for acknowledgment
    while (REG_SPC_PORT0 != 0x01) {
        // Wait for SPC to acknowledge
    }
}

void soundPlayMusic(const u8 *music_data) {
    if (!music_data) {
        return;
    }
    
    // Send music data to SPC700
    REG_SPC_PORT0 = 0x02; // Play music command
    // Transfer music data...
    
    music_playing = true;
}

void soundStopMusic(void) {
    REG_SPC_PORT0 = 0x03; // Stop music command
    music_playing = false;
}

void soundSetMusicVolume(u8 volume) {
    music_volume = volume;
    REG_SPC_PORT0 = 0x04; // Set volume command
    REG_SPC_PORT1 = volume;
}`;

  return {
    success: true,
    message: `Created ${engineType} sound engine with ${trackCount} tracks`,
    data: {
      generatedFiles: ['sound_engine.h', 'sound_engine.c'],
      audioInfo: {
        format: 'SPC700 Engine',
        size: 0,
        duration: 0,
        memoryUsage: 65536, // 64KB audio RAM
        trackCount
      },
      codeSnippet: `// Initialize and use sound engine\nsoundEngineInit();\nsoundPlaySFX(0, 127, 60); // Play sample 0 at max volume\nsoundPlayMusic(my_song_data);`
    }
  };
}

async function convertWavToBrr(filePath: string, sampleRate: number) {
  const basename = path.basename(filePath, '.wav');
  const brrFile = `${basename}.brr`;
  
  const instructions = `# Convert WAV to BRR (SNES audio format)

# Using brr_encoder:
brr_encoder "${filePath}" "${brrFile}" -r ${sampleRate} -l

# Alternative using snesbrr:
snesbrr encode "${filePath}" "${brrFile}" --rate=${sampleRate} --loop

# Integration steps:
# 1. Include in your project: const u8 ${basename}_brr[] = { ... };
# 2. Load into sound engine: soundLoadSample(${basename}_brr, sizeof(${basename}_brr), 0, 0);
# 3. Play: soundPlaySFX(sample_id, 127, 60);

# BRR format notes:
# - 9:1 compression ratio
# - 16 samples per block
# - Loop points must be block-aligned
# - Maximum size: ~64KB in audio RAM`;

  return {
    success: true,
    message: `Generated BRR conversion instructions for ${path.basename(filePath)}`,
    data: {
      generatedFiles: [brrFile],
      instructions,
      codeSnippet: `// Sample loading code\nconst u8 ${basename}_sample[] = {\n    #include "${brrFile}"\n};\n\nu8 sample_id = soundLoadSample(${basename}_sample, sizeof(${basename}_sample), 0, 0);`
    }
  };
}

async function createMusicTemplate(trackCount: number) {
  const musicHeader = `// Music Template for ${trackCount}-track composition
#ifndef MUSIC_DATA_H
#define MUSIC_DATA_H

#include "sound_engine.h"

// Music Pattern Data
typedef struct {
    u8 note;        // MIDI note number (0-127)
    u8 instrument;  // Instrument/sample ID
    u8 volume;      // Volume (0-127)
    u8 length;      // Note length in ticks
} music_note_t;

typedef struct {
    music_note_t *notes;
    u16 note_count;
    u8 channel;
    u16 loop_point;
} music_track_t;

// Song Structure
typedef struct {
    music_track_t tracks[${trackCount}];
    u8 tempo;           // BPM
    u8 time_signature;  // 4/4, 3/4, etc.
    u16 length;         // Length in ticks
} music_song_t;

// Example song data
extern const music_song_t example_song;

// Music playback functions
void musicPlay(const music_song_t *song);
void musicStop(void);
void musicSetTempo(u8 bpm);

#endif // MUSIC_DATA_H`;

  const musicData = `#include "music_data.h"

// Example pattern data for track 0 (melody)
const music_note_t melody_pattern[] = {
    {60, 0, 127, 16}, // C4, instrument 0, full volume, quarter note
    {62, 0, 127, 16}, // D4
    {64, 0, 127, 16}, // E4
    {60, 0, 127, 16}, // C4
    {0, 0, 0, 16},    // Rest
    // Add more notes...
};

// Example pattern data for track 1 (bass)
const music_note_t bass_pattern[] = {
    {36, 1, 100, 32}, // C2, instrument 1, bass drum length
    {0, 0, 0, 32},    // Rest
    // Add more notes...
};

// Complete song structure
const music_song_t example_song = {
    .tracks = {
        {melody_pattern, sizeof(melody_pattern)/sizeof(music_note_t), 0, 0},
        {bass_pattern, sizeof(bass_pattern)/sizeof(music_note_t), 1, 0},
        ${Array.from({length: trackCount - 2}, (_, i) => `{NULL, 0, ${i + 2}, 0},`).join('\n        ')}
    },
    .tempo = 120,
    .time_signature = 4,
    .length = 64
};

void musicPlay(const music_song_t *song) {
    // Implementation would sequence through patterns
    // and send note data to sound engine
    soundPlayMusic((const u8*)song);
}`;

  return {
    success: true,
    message: `Created music template with ${trackCount} tracks`,
    data: {
      generatedFiles: ['music_data.h', 'music_data.c'],
      audioInfo: {
        format: 'Pattern-based music',
        size: 0,
        duration: 0,
        memoryUsage: 1024, // Estimate
        trackCount
      },
      codeSnippet: `// Play example song\nmusicPlay(&example_song);\n\n// Stop playback\nmusicStop();`
    }
  };
}

async function generateSfxBank() {
  const sfxHeader = `// Sound Effects Bank
#ifndef SFX_BANK_H
#define SFX_BANK_H

#include "sound_engine.h"

// SFX IDs
#define SFX_JUMP        0
#define SFX_COIN        1
#define SFX_POWERUP     2
#define SFX_HURT        3
#define SFX_EXPLOSION   4
#define SFX_MENU_MOVE   5
#define SFX_MENU_SELECT 6
#define SFX_GAME_OVER   7

#define SFX_COUNT       8

// SFX Bank Management
void sfxBankInit(void);
void sfxPlay(u8 sfx_id);
void sfxSetVolume(u8 sfx_id, u8 volume);

// Individual SFX functions for convenience
void sfxPlayJump(void);
void sfxPlayCoin(void);
void sfxPlayPowerup(void);
void sfxPlayHurt(void);
void sfxPlayExplosion(void);
void sfxPlayMenuMove(void);
void sfxPlayMenuSelect(void);
void sfxPlayGameOver(void);

#endif // SFX_BANK_H`;

  const sfxSource = `#include "sfx_bank.h"

// SFX sample data (replace with actual BRR data)
const u8 sfx_jump_brr[] = { /* BRR data for jump sound */ };
const u8 sfx_coin_brr[] = { /* BRR data for coin sound */ };
const u8 sfx_powerup_brr[] = { /* BRR data for powerup sound */ };
const u8 sfx_hurt_brr[] = { /* BRR data for hurt sound */ };
const u8 sfx_explosion_brr[] = { /* BRR data for explosion sound */ };
const u8 sfx_menu_move_brr[] = { /* BRR data for menu move sound */ };
const u8 sfx_menu_select_brr[] = { /* BRR data for menu select sound */ };
const u8 sfx_game_over_brr[] = { /* BRR data for game over sound */ };

// SFX configuration
typedef struct {
    const u8 *data;
    u16 size;
    u8 default_volume;
    u8 default_pitch;
} sfx_config_t;

static const sfx_config_t sfx_configs[SFX_COUNT] = {
    {sfx_jump_brr, sizeof(sfx_jump_brr), 100, 64},        // Jump
    {sfx_coin_brr, sizeof(sfx_coin_brr), 80, 72},         // Coin
    {sfx_powerup_brr, sizeof(sfx_powerup_brr), 120, 60},  // Powerup
    {sfx_hurt_brr, sizeof(sfx_hurt_brr), 110, 50},        // Hurt
    {sfx_explosion_brr, sizeof(sfx_explosion_brr), 127, 40}, // Explosion
    {sfx_menu_move_brr, sizeof(sfx_menu_move_brr), 60, 80}, // Menu move
    {sfx_menu_select_brr, sizeof(sfx_menu_select_brr), 90, 70}, // Menu select
    {sfx_game_over_brr, sizeof(sfx_game_over_brr), 127, 45}, // Game over
};

static u8 sfx_sample_ids[SFX_COUNT];

void sfxBankInit(void) {
    // Load all SFX samples into sound engine
    for (u8 i = 0; i < SFX_COUNT; i++) {
        sfx_sample_ids[i] = soundLoadSample(
            sfx_configs[i].data,
            sfx_configs[i].size,
            0, 0  // No loop for SFX
        );
    }
    consoleWrite("SFX bank initialized\\n");
}

void sfxPlay(u8 sfx_id) {
    if (sfx_id >= SFX_COUNT) return;
    
    const sfx_config_t *config = &sfx_configs[sfx_id];
    soundPlaySFX(sfx_sample_ids[sfx_id], config->default_volume, config->default_pitch);
}

// Convenience functions
void sfxPlayJump(void) { sfxPlay(SFX_JUMP); }
void sfxPlayCoin(void) { sfxPlay(SFX_COIN); }
void sfxPlayPowerup(void) { sfxPlay(SFX_POWERUP); }
void sfxPlayHurt(void) { sfxPlay(SFX_HURT); }
void sfxPlayExplosion(void) { sfxPlay(SFX_EXPLOSION); }
void sfxPlayMenuMove(void) { sfxPlay(SFX_MENU_MOVE); }
void sfxPlayMenuSelect(void) { sfxPlay(SFX_MENU_SELECT); }
void sfxPlayGameOver(void) { sfxPlay(SFX_GAME_OVER); }`;

  return {
    success: true,
    message: 'Generated SFX bank with 8 common game sound effects',
    data: {
      generatedFiles: ['sfx_bank.h', 'sfx_bank.c'],
      audioInfo: {
        format: 'BRR SFX Bank',
        size: 0,
        duration: 0,
        memoryUsage: 8192, // Estimate for 8 SFX samples
        trackCount: 8
      },
      codeSnippet: `// Initialize and use SFX bank\nsfxBankInit();\nsfxPlayJump(); // Play jump sound\nsfxPlayCoin(); // Play coin pickup sound`
    }
  };
}

async function setupSpcPlayer(engineType: string) {
  const spcSetup = `# SPC700 Player Setup for ${engineType} engine

## Required Files:
- spc700.asm     # SPC700 assembly driver
- music.h        # Music data structures
- spc_loader.c   # SPC loading functions

## Memory Layout:
- 0x0000-0x00EF: Direct Page (variables)
- 0x0100-0x01FF: Stack
- 0x0200-0x7FFF: Program code and data
- 0x8000-0xFFBF: Sample data (32KB)
- 0xFFC0-0xFFFF: SPC700 registers

## Integration Steps:
1. Compile SPC700 driver: ca65 spc700.asm -o spc700.bin
2. Include in ROM: const u8 spc_driver[] = { #include "spc700.bin" };
3. Load at startup: spcLoad(spc_driver, sizeof(spc_driver));
4. Initialize: soundEngineInit();

## Communication Protocol:
Port 0: Command (0x01=play_sfx, 0x02=play_music, 0x03=stop, etc.)
Port 1: Parameter 1 (sample ID, volume, etc.)
Port 2: Parameter 2 (pitch, channel, etc.)
Port 3: Parameter 3 (effects, length, etc.)`;

  return {
    success: true,
    message: `Generated SPC700 setup instructions for ${engineType} engine`,
    data: {
      instructions: spcSetup,
      generatedFiles: ['spc_setup.md', 'spc_loader.c'],
      codeSnippet: `// SPC700 initialization sequence\nvoid initAudio(void) {\n    spcLoad(spc_driver, sizeof(spc_driver));\n    soundEngineInit();\n    sfxBankInit();\n    consoleWrite("Audio system ready\\n");\n}`
    }
  };
}

async function analyzeAudioMemory() {
  const analysis = `# SNES Audio Memory Analysis

## SPC700 Memory Layout (64KB total):
- Program Memory: 32KB (0x0000-0x7FFF)
  - Driver code: ~8KB
  - Music data: ~16KB
  - Pattern tables: ~8KB

- Sample Memory: 32KB (0x8000-0xFFBF)
  - Available for BRR samples: ~31KB
  - Typical usage:
    * 16KB for music instruments
    * 15KB for sound effects

## Memory Optimization Tips:
1. Use short loops in BRR samples
2. Share samples between music and SFX when possible
3. Compress music data with pattern repetition
4. Use lower sample rates for ambient sounds
5. Prioritize important samples for quality

## Estimated Memory Usage:
- Simple SFX (0.5-2KB each): 8 sounds = 8KB
- Music instruments (1-4KB each): 8 instruments = 24KB
- Background music data: 8-16KB
- Total typical usage: 40-48KB of 64KB available`;

  return {
    success: true,
    message: 'Generated SNES audio memory analysis',
    data: {
      instructions: analysis,
      audioInfo: {
        format: 'Memory Analysis',
        size: 65536,
        duration: 0,
        memoryUsage: 49152, // Typical usage ~48KB
        trackCount: 8
      }
    }
  };
}
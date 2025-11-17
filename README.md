# MCP-PVSnesLib

[![Build Status](https://github.com/user/mcp-pvsneslib/workflows/CI/badge.svg)](https://github.com/user/mcp-pvsneslib/actions)
[![npm version](https://badge.fury.io/js/mcp-pvsneslib.svg)](https://www.npmjs.com/package/mcp-pvsneslib)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A comprehensive Model Context Protocol (MCP) server for Super Nintendo Entertainment System (SNES) game development using [PVSnesLib](https://github.com/alekmaul/pvsneslib). This server provides AI assistants with powerful tools for creating 16-bit games, managing graphics, audio, sprites, and tilemaps.

## 🎮 Features

### Core SNES Development Tools

- **🎨 Sprite Manager**: Create, convert, and optimize SNES sprites with support for 8x8, 16x16, and 32x32 sizes
- **🔊 Sound Engine**: Manage SPC700 audio, convert samples to BRR format, and create music systems  
- **🖼️ Graphics Converter**: Convert modern image formats to SNES-compatible tiles and palettes
- **�️ Tilemap Generator**: Create levels, backgrounds, and collision maps with support for Tiled Editor
- **🌈 Palette Manager**: Advanced color palette tools with gradients, optimization, and fade effects

### Advanced Features

- **Collision Detection Systems**: Tile-based physics and collision handling
- **Parallax Scrolling**: Multi-layer background effects
- **Level Editors**: In-game editing tools for rapid prototyping
- **Memory Optimization**: Tools for managing SNES memory constraints
- **Asset Pipeline**: Automated conversion from modern formats to SNES data

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- A Model Context Protocol client (Claude Desktop, etc.)
- PVSnesLib development environment (optional, for compiling generated code)

### Installation

```bash
npm install -g mcp-pvsneslib
```

### Configuration

Add to your MCP client configuration:

```json
{
  "servers": {
    "mcp-pvsneslib": {
      "command": "mcp-pvsneslib", 
      "args": []
    }
  }
}
```

### Basic Usage

```typescript
// Create a sprite with animation frames
sprite_manager({
  action: "create_sprite_template",
  spriteName: "mario",
  spriteSize: "16x16", 
  colorDepth: "4bpp",
  includeAnimation: true
});

// Convert PNG to SNES format
graphics_converter({
  action: "convert_png_to_tiles",
  filePath: "./assets/mario.png",
  tileSize: "16x16",
  colorDepth: "4bpp",
  generateCode: true
});

// Create background music
sound_engine({
  action: "create_sound_engine",
  engineType: "tracker",
  trackCount: 4
});

// Generate level tilemap
tilemap_generator({
  action: "create_tilemap",
  levelName: "level1",
  mapWidth: 64,
  mapHeight: 32,
  includeCollision: true
});
```

## 🛠️ Tools Reference

### Sprite Manager

Manage SNES sprites with full animation and optimization support.

**Actions:**
- `create_sprite_template`: Generate C code templates for sprites
- `convert_png_to_chr`: Convert PNG images to SNES CHR format
- `analyze_sprite_data`: Examine existing sprite files
- `optimize_palette`: Reduce colors and improve memory usage
- `generate_sprite_header`: Create header files for sprites

**Example:**
```typescript
sprite_manager({
  action: "create_sprite_template",
  spriteName: "player",
  spriteSize: "16x16",
  colorDepth: "4bpp", 
  includeAnimation: true
});
```

### Sound Engine

Complete SPC700 audio system for music and sound effects.

**Actions:**
- `create_sound_engine`: Set up SPC700 audio driver
- `convert_wav_to_brr`: Convert WAV files to BRR samples
- `create_music_template`: Generate pattern-based music system
- `generate_sfx_bank`: Create sound effects library
- `setup_spc_player`: Configure audio playback system

**Example:**
```typescript
sound_engine({
  action: "convert_wav_to_brr",
  filePath: "./sounds/jump.wav",
  sampleRate: 22050
});
```

### Graphics Converter

Convert modern graphics to SNES-compatible formats.

**Actions:**
- `convert_png_to_tiles`: Convert images to tile data
- `create_palette`: Extract and optimize color palettes
- `optimize_tileset`: Remove duplicates and compress
- `generate_background`: Create scrolling backgrounds  
- `create_font`: Generate bitmap fonts
- `batch_convert`: Process multiple files

**Example:**
```typescript
graphics_converter({
  action: "convert_png_to_tiles",
  filePath: "./graphics/background.png",
  tileSize: "8x8",
  colorMode: "4bpp",
  removeDuplicates: true
});
```

### Tilemap Generator

Create levels, maps, and collision systems.

**Actions:**
- `create_tilemap`: Generate level data and code
- `convert_tiled_map`: Import from Tiled Map Editor
- `generate_collision`: Create collision detection system
- `create_level_editor`: Build in-game editing tools
- `generate_parallax`: Multi-layer scrolling backgrounds
- `create_minimap`: Navigation and overview systems

**Example:**
```typescript
tilemap_generator({
  action: "create_tilemap",
  levelName: "castle",
  mapWidth: 128,
  mapHeight: 32,
  mapMode: "64x32",
  includeCollision: true
});
```

### Palette Manager

Advanced color management and effects.

**Actions:**
- `create_palette`: Generate color palettes
- `convert_rgb_to_snes`: Color format conversion
- `generate_gradient`: Create smooth color transitions
- `create_fade_effect`: Fade in/out effects
- `optimize_colors`: Reduce palette size
- `extract_from_image`: Pull colors from existing graphics

**Example:**
```typescript
palette_manager({
  action: "generate_gradient",
  startColor: "#000080",
  endColor: "#87CEEB", 
  steps: 16,
  paletteName: "sky_gradient"
});

## 🎯 SNES Development Workflow

### 1. Asset Creation

```typescript
// Convert your modern assets
graphics_converter({
  action: "batch_convert",
  filePath: "./assets/",
  outputPath: "./snes_assets/",
  tileSize: "8x8",
  colorMode: "4bpp"
});

// Optimize palettes
palette_manager({
  action: "optimize_colors", 
  colors: ["#FF0000", "#00FF00", "#0000FF", ...],
  colorMode: "4bpp"
});
```

### 2. Sprite Setup

```typescript
// Create sprite system
sprite_manager({
  action: "create_sprite_template",
  spriteName: "hero",
  spriteSize: "16x16",
  includeAnimation: true
});

// Generate sprite data
sprite_manager({
  action: "convert_png_to_chr",
  filePath: "./assets/hero_spritesheet.png",
  spriteSize: "16x16"
});
```

### 3. Level Design

```typescript
// Create level tilemap
tilemap_generator({
  action: "create_tilemap",
  levelName: "world1_1", 
  mapWidth: 256,
  mapHeight: 32,
  includeCollision: true
});

// Add parallax layers
tilemap_generator({
  action: "generate_parallax",
  mapWidth: 256,
  mapHeight: 32
});
```

### 4. Audio Integration

```typescript
// Set up sound system
sound_engine({
  action: "create_sound_engine",
  engineType: "sequencer",
  trackCount: 6
});

// Convert audio assets
sound_engine({
  action: "convert_wav_to_brr",
  filePath: "./audio/music_theme.wav"
});
```

## 🏗️ Generated Code Structure

The tools generate a complete SNES project structure:

```
my_game/
├── src/
│   ├── sprites/
│   │   ├── hero.h
│   │   ├── hero.c
│   │   └── hero_gfx.chr
│   ├── backgrounds/
│   │   ├── level1.h
│   │   ├── level1.c
│   │   └── level1_map.bin
│   ├── audio/
│   │   ├── sound_engine.h
│   │   ├── sound_engine.c
│   │   └── samples/
│   ├── palettes/
│   │   ├── main_palette.h
│   │   └── main_palette.c
│   └── main.c
├── assets/
│   ├── graphics/
│   ├── audio/
│   └── levels/
└── build/
    ├── Makefile
    └── game.sfc
```

Ready to create the next great 16-bit masterpiece? Get started with MCP-PVSnesLib today! 🎮✨

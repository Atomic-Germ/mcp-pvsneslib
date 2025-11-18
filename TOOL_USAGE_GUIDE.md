# MCP-PVSnesLib Tool Usage Guide

## Quick Reference for AI Assistants

### Graphics Converter (`graphics_converter`)
**Action Values:**
- `convert_png_to_tiles` - Convert PNG images to SNES tile format
- `create_palette` - Generate optimized color palettes
- `generate_background` - Create SNES background layers
- `analyze_graphics` - Analyze image for SNES compatibility
- `optimize_tileset` - Remove duplicates and optimize tiles
- `create_font` - Generate bitmap fonts for SNES
- `batch_convert` - Process multiple images at once

**Common Parameters:**
```json
{
  "action": "convert_png_to_tiles",
  "filePath": "/path/to/image.png",
  "colorMode": "4bpp",          // "2bpp", "4bpp", "8bpp", "mode7"
  "tileSize": "8x8",            // "8x8", "16x16", "32x32"
  "compressionType": "none",     // "none", "rle", "lz4", "custom"
  "generateCode": true,
  "removeDuplicates": true
}
```

### Sound Engine (`sound_engine`)
**Action Values:**
- `create_sound_engine` - Set up basic audio system
- `convert_wav_to_brr` - Convert WAV to SPC-700 BRR format
- `create_music_template` - Generate music system template
- `generate_sfx_bank` - Create sound effects bank
- `setup_spc_player` - Configure SPC music player
- `analyze_audio_memory` - Check audio memory usage

**Common Parameters:**
```json
{
  "action": "create_sound_engine",
  "filePath": "/path/to/output",
  "audioFormat": "BRR",         // "BRR", "SPC", "IT", "NSF"
  "channels": 1,                // 1 (mono) or 2 (stereo)
  "engineType": "simple",       // "simple", "sequencer", "tracker"
  "sampleRate": 32000,          // 8000, 11025, 16000, 22050, 32000
  "trackCount": 4
}
```

### Tilemap Generator (`tilemap_generator`)
**Action Values:**
- `create_tilemap` - Generate basic tilemap structure
- `convert_tiled_map` - Import from Tiled Map Editor
- `generate_collision` - Create collision detection data
- `create_level_editor` - Generate level editing tools
- `optimize_map` - Optimize map data for SNES
- `generate_parallax` - Create parallax scrolling layers
- `create_minimap` - Generate minimap system

**Common Parameters:**
```json
{
  "action": "create_tilemap",
  "levelName": "level1",
  "mapWidth": 32,               // Width in tiles
  "mapHeight": 32,              // Height in tiles
  "tileSize": "8x8",            // Tile size
  "includeCollision": true,
  "outputFormat": "c_array"     // Output format
}
```

### Sprite Manager (`sprite_manager`)
**Action Values:**
- `create_sprite_template` - Generate sprite system template
- `convert_png_to_chr` - Convert PNG to CHR sprite format
- `analyze_sprite_data` - Analyze sprite for SNES limits
- `optimize_palette` - Optimize sprite color palette
- `generate_sprite_header` - Create C header files

**Common Parameters:**
```json
{
  "action": "create_sprite_template",
  "filePath": "/path/to/output",
  "spriteSize": "16x16",        // "8x8", "16x16", "32x32", "64x64"
  "colorDepth": "4bpp",         // "4bpp", "8bpp"
  "spriteName": "player",
  "includeAnimation": true
}
```

### Palette Manager (`palette_manager`)
**Action Values:**
- `create_palette` - Generate color palette
- `optimize_colors` - Optimize existing palette
- `generate_gradient` - Create color gradients
- `fade_effect` - Generate fade effects
- `convert_palette` - Convert between formats

**Common Parameters:**
```json
{
  "action": "create_palette",
  "colors": ["#FF0000", "#00FF00", "#0000FF"],
  "colorMode": "4bpp",          // "2bpp", "4bpp", "8bpp"
  "paletteName": "main_palette"
}
```

### PVSnesLib Setup Tools

#### Host Validation (`pvsneslib_validate_host`)
```json
{
  "action": "validate_host",
  "verbose": true
}
```

#### SDK Installation (`pvsneslib_install_sdk`)
```json
{
  "action": "install_sdk",
  "version": "4.3.0",
  "installPath": "./vendor/pvsneslib"
}
```

#### Tool Configuration (`configure_tools`)
```json
{
  "action": "configure_tools",
  "projectPath": "/path/to/project",
  "compilerFlags": ["--debug", "--verbose"],
  "optimizationLevel": "basic",  // "none", "basic", "aggressive"
  "debugMode": true
}
```

## Tips for AI Assistants

1. **Always check action values** - Use exact action names from this guide
2. **Use appropriate enum values** - Check parameter descriptions for valid options
3. **Start simple** - Begin with basic actions before trying advanced features
4. **Include file paths** - Most tools need input/output file specifications
5. **Use descriptive names** - Level names, sprite names, etc. help with organization
6. **Check SNES limits** - 4bpp is most common, 8x8 tiles for backgrounds, 16x16 for sprites

## Common Workflows

### Basic Graphics Setup:
1. `graphics_converter` with `convert_png_to_tiles`
2. `palette_manager` with `optimize_colors`
3. `sprite_manager` with `create_sprite_template`

### Audio Setup:
1. `sound_engine` with `create_sound_engine`
2. `sound_engine` with `convert_wav_to_brr` for samples
3. `sound_engine` with `create_music_template`

### Level Creation:
1. `tilemap_generator` with `create_tilemap`
2. `tilemap_generator` with `generate_collision`
3. `graphics_converter` with `generate_background`
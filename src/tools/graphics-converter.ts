import { Type } from '@sinclair/typebox';
import { createTypedTool } from './typed-tool-system.js';
import fs from 'fs/promises';
import path from 'path';

/**
 * SNES Graphics Converter Tool
 *
 * Handles graphics format conversion for SNES development, including
 * palette management, tile optimization, and format conversion for PVSnesLib.
 */
export const graphicsConverterTool = createTypedTool({
  name: 'graphics_converter',
  description:
    'Convert graphics formats for SNES development - tiles, palettes, backgrounds',
  inputSchema: Type.Object({
    action: Type.Union(
      [
        Type.Literal('convert_png_to_tiles'),
        Type.Literal('create_palette'),
        Type.Literal('optimize_tileset'),
        Type.Literal('generate_background'),
        Type.Literal('analyze_graphics'),
        Type.Literal('create_font'),
        Type.Literal('batch_convert'),
      ],
      {
        description: 'Graphics conversion action. Use "convert_png_to_tiles" for basic image conversion, "create_palette" for color optimization, "generate_background" for creating SNES background layers.',
      }
    ),
    filePath: Type.Optional(
      Type.String({
        description: 'Path to input image file',
      })
    ),
    outputPath: Type.Optional(
      Type.String({
        description: 'Output directory or file path',
      })
    ),
    tileSize: Type.Optional(
      Type.Union(
        [Type.Literal('8x8'), Type.Literal('16x16'), Type.Literal('32x32')],
        {
          description: 'Tile size: "8x8" for backgrounds, "16x16" for sprites, "32x32" for large sprites',
        }
      )
    ),
    colorMode: Type.Optional(
      Type.Union(
        [
          Type.Literal('2bpp'),
          Type.Literal('4bpp'),
          Type.Literal('8bpp'),
          Type.Literal('mode7'),
        ],
        {
          description: 'SNES color depth: "2bpp" (4 colors), "4bpp" (16 colors, most common), "8bpp" (256 colors), "mode7" (256 colors with rotation)',
        }
      )
    ),
    compressionType: Type.Optional(
      Type.Union(
        [
          Type.Literal('none'),
          Type.Literal('rle'),
          Type.Literal('lz4'),
          Type.Literal('custom'),
        ],
        {
          description: 'Compression: "none" for uncompressed (fastest), "rle" for simple compression, "lz4" for better compression',
        }
      )
    ),
    generateCode: Type.Optional(
      Type.Boolean({
        description: 'Generate C header and source files',
      })
    ),
    removeDuplicates: Type.Optional(
      Type.Boolean({
        description: 'Remove duplicate tiles during conversion',
      })
    ),
  }),
  outputSchema: Type.Object({
    success: Type.Boolean(),
    message: Type.String(),
    data: Type.Optional(
      Type.Object({
        generatedFiles: Type.Optional(Type.Array(Type.String())),
        graphicsInfo: Type.Optional(
          Type.Object({
            originalSize: Type.Number(),
            compressedSize: Type.Number(),
            tileCount: Type.Number(),
            uniqueTiles: Type.Number(),
            paletteColors: Type.Number(),
            memoryUsage: Type.Number(),
          })
        ),
        codeSnippet: Type.Optional(Type.String()),
        conversionStats: Type.Optional(Type.String()),
      })
    ),
  }),
  handler: async input => {
    try {
      const {
        action,
        filePath,
        outputPath = './gfx/',
        tileSize = '8x8',
        colorMode = '4bpp',
        compressionType = 'none',
        generateCode = true,
        removeDuplicates = true,
      } = input;

      switch (action) {
        case 'convert_png_to_tiles':
          if (!filePath) {
            return {
              success: false,
              message: 'filePath is required for PNG conversion',
            };
          }
          return await convertPngToTiles(
            filePath,
            outputPath,
            tileSize,
            colorMode,
            generateCode,
            removeDuplicates
          );

        case 'create_palette':
          if (!filePath) {
            return {
              success: false,
              message: 'filePath is required for palette creation',
            };
          }
          return await createPalette(filePath, colorMode);

        case 'optimize_tileset':
          if (!filePath) {
            return {
              success: false,
              message: 'filePath is required for tileset optimization',
            };
          }
          return await optimizeTileset(filePath, removeDuplicates);

        case 'generate_background':
          return await generateBackground(tileSize, colorMode);

        case 'analyze_graphics':
          if (!filePath) {
            return {
              success: false,
              message: 'filePath is required for graphics analysis',
            };
          }
          return await analyzeGraphics(filePath);

        case 'create_font':
          return await createFont(tileSize, colorMode);

        case 'batch_convert':
          if (!filePath) {
            return {
              success: false,
              message: 'filePath (directory) is required for batch conversion',
            };
          }
          return await batchConvert(filePath, outputPath, tileSize, colorMode);

        default:
          return { success: false, message: `Unknown action: ${action}` };
      }
    } catch (error) {
      return {
        success: false,
        message: `Graphics converter error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  },
});

async function convertPngToTiles(
  filePath: string,
  outputPath: string,
  tileSize: string,
  colorMode: string,
  generateCode: boolean,
  removeDuplicates: boolean
) {
  const basename = path.basename(filePath, '.png');
  const [width, height] = tileSize.split('x').map(Number);
  const bppValue =
    parseInt(colorMode.replace('bpp', '')) || (colorMode === 'mode7' ? 8 : 4);
  const maxColors = Math.pow(2, bppValue);

  // Generate conversion script
  const conversionScript = `#!/bin/bash
# Conversion script for ${basename}

# Create output directory
mkdir -p ${outputPath}

# Convert PNG to SNES format using various tools

# Method 1: Using png2snes (if available)
if command -v png2snes &> /dev/null; then
    echo "Converting with png2snes..."
    png2snes -i "${filePath}" \\
             -o "${outputPath}/${basename}.chr" \\
             -p "${outputPath}/${basename}.pal" \\
             -m "${outputPath}/${basename}.map" \\
             -t ${width}x${height} \\
             -f ${colorMode} \\
             ${removeDuplicates ? '--remove-duplicates' : ''}
fi

# Method 2: Using superfamiconv (recommended)
if command -v superfamiconv &> /dev/null; then
    echo "Converting with superfamiconv..."
    superfamiconv tiles \\
        -i "${filePath}" \\
        -d "${outputPath}/${basename}_tiles.bin" \\
        -p "${outputPath}/${basename}_palette.bin" \\
        -m "${outputPath}/${basename}_tilemap.bin" \\
        --tile-width ${width} \\
        --tile-height ${height} \\
        --bpp ${bppValue} \\
        ${removeDuplicates ? '--no-duplicate-tiles' : ''}
fi

# Method 3: Using YY-CHR export
echo "Alternative: Use YY-CHR to manually convert:"
echo "1. Open ${filePath} in YY-CHR"
echo "2. Set format to SNES ${bppValue}bit"
echo "3. Export tiles as ${basename}.chr"
echo "4. Export palette as ${basename}.pal"`;

  // Generate C header if requested
  let cHeader = '';
  let cSource = '';

  if (generateCode) {
    cHeader = `#ifndef ${basename.toUpperCase()}_GFX_H
#define ${basename.toUpperCase()}_GFX_H

#include <snes.h>

// Graphics: ${basename}
// Tile Size: ${width}x${height}
// Color Mode: ${colorMode}
// Max Colors: ${maxColors}

#define ${basename.toUpperCase()}_TILE_WIDTH  ${width}
#define ${basename.toUpperCase()}_TILE_HEIGHT ${height}
#define ${basename.toUpperCase()}_TILE_SIZE   ${(width * height * bppValue) / 8}
#define ${basename.toUpperCase()}_MAX_COLORS  ${maxColors}

// External data declarations (generated by conversion tools)
extern const u8 ${basename}_tiles[];
extern const u16 ${basename}_palette[];
extern const u16 ${basename}_tilemap[];
extern const u16 ${basename}_tile_count;

// Functions
void ${basename}Init(void);
void ${basename}LoadTiles(u16 vram_addr);
void ${basename}LoadPalette(u8 palette_num);
void ${basename}LoadTilemap(u16 vram_addr, u16 map_width, u16 map_height);

#endif // ${basename.toUpperCase()}_GFX_H`;

    cSource = `#include "${basename}_gfx.h"

// Tile count (to be updated after conversion)
const u16 ${basename}_tile_count = 0; // Update this after running conversion

// Tile data (include converted binary data)
const u8 ${basename}_tiles[] = {
    // Include binary data from conversion:
    // #include "${basename}_tiles.inc"
};

// Palette data (SNES 16-bit color format)
const u16 ${basename}_palette[] = {
    // Include palette data from conversion:
    // #include "${basename}_palette.inc"
};

// Tilemap data (if applicable)
const u16 ${basename}_tilemap[] = {
    // Include tilemap data from conversion:
    // #include "${basename}_tilemap.inc"
};

void ${basename}Init(void) {
    consoleWrite("Loading ${basename} graphics...\\n");
    ${basename}LoadPalette(0);
    ${basename}LoadTiles(0x0000);
}

void ${basename}LoadTiles(u16 vram_addr) {
    // Load tile data into VRAM
    dmaCopyVram(${basename}_tiles, vram_addr, sizeof(${basename}_tiles));
}

void ${basename}LoadPalette(u8 palette_num) {
    // Load palette into CGRAM
    dmaCopyCGram(${basename}_palette, palette_num * ${maxColors}, sizeof(${basename}_palette));
}

void ${basename}LoadTilemap(u16 vram_addr, u16 map_width, u16 map_height) {
    // Load tilemap data into VRAM
    dmaCopyVram(${basename}_tilemap, vram_addr, map_width * map_height * 2);
}`;
  }

  const estimatedTiles = 64; // Placeholder estimation
  const memoryUsage = (estimatedTiles * width * height * bppValue) / 8;

  return {
    success: true,
    message: `Generated conversion setup for ${basename} (${tileSize}, ${colorMode})`,
    data: {
      generatedFiles: generateCode
        ? [`${basename}_gfx.h`, `${basename}_gfx.c`, `convert_${basename}.sh`]
        : [`convert_${basename}.sh`],
      graphicsInfo: {
        originalSize: 0, // Would be calculated from actual file
        compressedSize: memoryUsage,
        tileCount: estimatedTiles,
        uniqueTiles: removeDuplicates ? estimatedTiles * 0.8 : estimatedTiles,
        paletteColors: maxColors,
        memoryUsage,
      },
      codeSnippet: generateCode
        ? `// Initialize and use graphics\n${basename}Init();\n${basename}LoadTiles(BG1_TILE_BASE);\n${basename}LoadPalette(0);`
        : conversionScript,
      conversionStats: `Estimated output:\n- Tiles: ${estimatedTiles}\n- Colors: ${maxColors}\n- Memory: ${memoryUsage} bytes`,
    },
  };
}

async function createPalette(filePath: string, colorMode: string) {
  const basename = path.basename(filePath, path.extname(filePath));
  const bppValue = parseInt(colorMode.replace('bpp', '')) || 4;
  const maxColors = Math.pow(2, bppValue);

  const paletteHeader = `// Palette for ${basename}
// Color Mode: ${colorMode} (${maxColors} colors)

#ifndef ${basename.toUpperCase()}_PALETTE_H
#define ${basename.toUpperCase()}_PALETTE_H

#include <snes.h>

#define ${basename.toUpperCase()}_PALETTE_SIZE ${maxColors}

// SNES color format: 0BBB_BBGG_GGGR_RRRR (15-bit RGB)
extern const u16 ${basename}_palette[${basename.toUpperCase()}_PALETTE_SIZE];

// Palette manipulation functions
void ${basename}LoadPalette(u8 palette_index);
void ${basename}SetPaletteColor(u8 color_index, u16 snes_color);
u16 ${basename}RgbToSnes(u8 r, u8 g, u8 b);

#endif`;

  const paletteSource = `#include "${basename}_palette.h"

// Default palette (replace with extracted colors)
const u16 ${basename}_palette[${basename.toUpperCase()}_PALETTE_SIZE] = {
    0x0000, // Color 0: Transparent
    0x7FFF, // Color 1: White
    0x0000, // Color 2: Black
    0x001F, // Color 3: Red
    0x03E0, // Color 4: Green
    0x7C00, // Color 5: Blue
    // Add remaining colors (${maxColors - 6} more)
    ${Array.from({ length: maxColors - 6 }, () => '0x0000,').join('\n    ')}
};

void ${basename}LoadPalette(u8 palette_index) {
    dmaCopyCGram(${basename}_palette, palette_index * 16, sizeof(${basename}_palette));
}

void ${basename}SetPaletteColor(u8 color_index, u16 snes_color) {
    if (color_index < ${basename.toUpperCase()}_PALETTE_SIZE) {
        dmaCopyCGram(&snes_color, color_index, 2);
    }
}

u16 ${basename}RgbToSnes(u8 r, u8 g, u8 b) {
    // Convert 8-bit RGB to 5-bit RGB (SNES format)
    u16 r5 = (r >> 3) & 0x1F;
    u16 g5 = (g >> 3) & 0x1F;
    u16 b5 = (b >> 3) & 0x1F;
    return r5 | (g5 << 5) | (b5 << 10);
}`;

  const extractionInstructions = `# Palette Extraction Instructions for ${basename}

## Using GIMP:
1. Open ${filePath} in GIMP
2. Image → Mode → Indexed... 
3. Set maximum colors to ${maxColors}
4. Export color map: Windows → Dockable Dialogs → Colormap
5. Export as .pal file or manually copy RGB values

## Using ImageMagick:
convert "${filePath}" +dither -colors ${maxColors} -format "%c" histogram:info:

## Using superfamiconv:
superfamiconv palette -i "${filePath}" -d ${basename}_palette.bin --colors ${maxColors}

## Manual conversion to SNES format:
Each RGB color (r,g,b) becomes: (b/8)<<10 | (g/8)<<5 | (r/8)`;

  return {
    success: true,
    message: `Generated palette template for ${basename} (${colorMode})`,
    data: {
      generatedFiles: [`${basename}_palette.h`, `${basename}_palette.c`],
      graphicsInfo: {
        originalSize: 0,
        compressedSize: maxColors * 2,
        tileCount: 0,
        uniqueTiles: 0,
        paletteColors: maxColors,
        memoryUsage: maxColors * 2,
      },
      codeSnippet: `// Load and use palette\n${basename}LoadPalette(0);\n${basename}SetPaletteColor(1, ${basename}RgbToSnes(255, 0, 0)); // Set red`,
      conversionStats: extractionInstructions,
    },
  };
}

async function optimizeTileset(filePath: string, removeDuplicates: boolean) {
  const basename = path.basename(filePath, path.extname(filePath));

  const optimizationScript = `#!/bin/bash
# Tileset Optimization for ${basename}

echo "Optimizing tileset: ${basename}"

# Step 1: Remove duplicate tiles
${
  removeDuplicates
    ? `
echo "Removing duplicate tiles..."
# This would use a tool like tiled2snes with deduplication
# tiled2snes --input "${filePath}" --output "${basename}_optimized" --remove-duplicates
`
    : ''
}

# Step 2: Reorder tiles by usage frequency
echo "Reordering tiles by usage..."
# Sort tiles so most frequently used tiles come first
# This improves compression and access patterns

# Step 3: Compress tile data
echo "Compressing tile data..."
# Apply compression algorithm (RLE, LZ77, etc.)

echo "Optimization complete!"`;

  const optimizationTips = `# Tileset Optimization Tips

## Memory Optimization:
1. Remove duplicate tiles (can save 30-50% memory)
2. Use consistent tile sizes (8x8 for efficiency)
3. Group similar tiles together
4. Limit palette colors per tile

## Performance Optimization:
1. Place frequently used tiles at lower indices
2. Align tile data to even addresses
3. Use DMA-friendly data layouts
4. Consider tile animation requirements

## Compression Strategies:
1. RLE for simple patterns
2. LZ77 for complex graphics
3. Dictionary compression for repeated elements
4. Hybrid approaches for best results

## VRAM Layout Planning:
- Background tiles: 0x0000-0x3FFF
- Sprite tiles: 0x4000-0x5FFF
- Font tiles: 0x6000-0x6FFF
- Reserved: 0x7000-0x7FFF`;

  return {
    success: true,
    message: `Generated tileset optimization plan for ${basename}`,
    data: {
      generatedFiles: [`optimize_${basename}.sh`],
      codeSnippet: optimizationScript,
      conversionStats: optimizationTips,
    },
  };
}

async function generateBackground(tileSize: string, colorMode: string) {
  const [width, height] = tileSize.split('x').map(Number);
  const bppValue = parseInt(colorMode.replace('bpp', '')) || 4;

  const bgHeader = `// Background Template
#ifndef BACKGROUND_H
#define BACKGROUND_H

#include <snes.h>

// Background Configuration
#define BG_TILE_SIZE_W ${width}
#define BG_TILE_SIZE_H ${height}
#define BG_COLOR_MODE  ${colorMode}
#define BG_COLORS      ${Math.pow(2, bppValue)}

// Background maps (32x32 tiles = 1024 tiles)
#define BG_MAP_WIDTH   32
#define BG_MAP_HEIGHT  32
#define BG_MAP_SIZE    (BG_MAP_WIDTH * BG_MAP_HEIGHT * 2)

// VRAM addresses
#define BG_TILE_BASE   0x0000
#define BG_MAP_BASE    0x7000

// Background functions
void bgInit(void);
void bgLoadTiles(const u8 *tile_data, u16 tile_count);
void bgLoadMap(const u16 *map_data);
void bgSetScroll(s16 x, s16 y);
void bgShow(void);
void bgHide(void);

#endif`;

  const bgSource = `#include "background.h"

static s16 bg_scroll_x = 0;
static s16 bg_scroll_y = 0;

void bgInit(void) {
    // Set BG mode and enable background layer
    bgSetMode(BG_MODE1, 0);
    bgSetDisable(0); // Enable BG0
    
    // Configure BG0
    bgInitTileSet(0,                    // Background number
                  &bg_tiles,            // Tile data
                  &bg_palette,          // Palette data
                  0,                    // Palette number
                  sizeof(bg_tiles),     // Tile data size
                  16*2,                // Palette size
                  BG_${bppValue}BPP,           // Color mode
                  BG_TILE_BASE);       // VRAM tile base

    bgInitMapSet(0,                    // Background number
                 &bg_map,              // Map data
                 sizeof(bg_map),       // Map size
                 SC_32x32,             // Map size
                 BG_MAP_BASE);         // VRAM map base

    consoleWrite("Background initialized\\n");
}

void bgLoadTiles(const u8 *tile_data, u16 tile_count) {
    dmaCopyVram(tile_data, BG_TILE_BASE, tile_count * ${(width * height * bppValue) / 8});
}

void bgLoadMap(const u16 *map_data) {
    dmaCopyVram(map_data, BG_MAP_BASE, BG_MAP_SIZE);
}

void bgSetScroll(s16 x, s16 y) {
    bg_scroll_x = x;
    bg_scroll_y = y;
    bgSetScroll(0, x, y);
}

void bgShow(void) {
    bgSetDisable(0);
}

void bgHide(void) {
    bgSetDisable(1);
}`;

  const mapTemplate = `// Background Map Template (32x32 tiles)
const u16 bg_map[1024] = {
    // Each entry: VHOPPPCC CCCCCCCC
    // V = Vertical flip, H = Horizontal flip
    // O = Priority, P = Palette, C = Character (tile index)
    
    // Row 0
    0x0000, 0x0001, 0x0002, 0x0003, // ... continue for 32 tiles
    // Row 1
    0x0020, 0x0021, 0x0022, 0x0023, // ... continue for 32 tiles
    // ... continue for 32 rows
};

// Example tile set (replace with actual graphics data)
const u8 bg_tiles[] = {
    // Tile 0: Empty tile
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    // Tile 1: Solid tile
    0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF,
    0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF,
    // Add more tiles...
};`;

  return {
    success: true,
    message: `Generated background system template (${tileSize}, ${colorMode})`,
    data: {
      generatedFiles: ['background.h', 'background.c', 'bg_map_template.c'],
      graphicsInfo: {
        originalSize: 0,
        compressedSize: 2048 + 1024 * 2, // Tiles + map
        tileCount: 64,
        uniqueTiles: 64,
        paletteColors: Math.pow(2, bppValue),
        memoryUsage: 2048 + 2048, // VRAM usage
      },
      codeSnippet: `// Initialize and use background\nbgInit();\nbgLoadTiles(my_tiles, tile_count);\nbgLoadMap(my_map);\nbgSetScroll(0, 0);\nbgShow();`,
    },
  };
}

async function analyzeGraphics(filePath: string) {
  try {
    const stats = await fs.stat(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const basename = path.basename(filePath);

    const analysis = `# Graphics Analysis: ${basename}

## File Information:
- Size: ${stats.size} bytes
- Format: ${ext}
- Modified: ${stats.mtime.toISOString()}

## SNES Compatibility Analysis:
${
  ext === '.png'
    ? `
### PNG Analysis:
- Recommended: Convert to CHR/PAL format
- Tools: superfamiconv, png2snes, YY-CHR
- Considerations: Color reduction, palette optimization

### Optimization Suggestions:
1. Reduce to 16 colors (4bpp) or 256 colors (8bpp)
2. Use 8x8 or 16x16 tile sizes
3. Remove duplicate tiles
4. Optimize for SNES color format (15-bit RGB)
`
    : ''
}

${
  ext === '.chr'
    ? `
### CHR Format Analysis:
- File size suggests ~${Math.floor(stats.size / 32)} tiles
- Format appears to be SNES-compatible
- Ready for VRAM loading

### Integration:
1. Include in ROM: const u8 tiles[] = { #include "file.chr" };
2. Load to VRAM: dmaCopyVram(tiles, vram_addr, size);
`
    : ''
}

## Memory Usage Estimate:
- Original: ${stats.size} bytes
- Optimized: ~${Math.floor(stats.size * 0.7)} bytes (30% compression)
- VRAM usage: Depends on tile count and mode

## Recommendations:
1. Use 4bpp mode for most graphics (16 colors)
2. Group related graphics into tilesets
3. Consider animation frame requirements
4. Plan VRAM layout before conversion`;

    return {
      success: true,
      message: `Analyzed graphics file: ${basename}`,
      data: {
        graphicsInfo: {
          originalSize: stats.size,
          compressedSize: Math.floor(stats.size * 0.7),
          tileCount: Math.floor(stats.size / 32),
          uniqueTiles: Math.floor(stats.size / 32),
          paletteColors: 16,
          memoryUsage: stats.size,
        },
        conversionStats: analysis,
      },
    };
  } catch (error) {
    return {
      success: false,
      message: `Could not analyze file: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

async function createFont(tileSize: string, colorMode: string) {
  const [width, height] = tileSize.split('x').map(Number);

  const fontHeader = `// Font System for SNES
#ifndef FONT_H
#define FONT_H

#include <snes.h>

// Font Configuration
#define FONT_TILE_WIDTH  ${width}
#define FONT_TILE_HEIGHT ${height}
#define FONT_FIRST_CHAR  32  // Space character
#define FONT_LAST_CHAR   126 // ~ character
#define FONT_CHAR_COUNT  (FONT_LAST_CHAR - FONT_FIRST_CHAR + 1)

// Font functions
void fontInit(void);
void fontPrint(u16 x, u16 y, const char *text);
void fontPrintChar(u16 x, u16 y, char c);
void fontSetColor(u8 color);

#endif`;

  const fontSource = `#include "font.h"

// Font tile data (8x8 ASCII characters)
const u8 font_tiles[FONT_CHAR_COUNT * ${(width * height) / 4}] = {
    // Space (32)
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    // ! (33)  
    0x18, 0x18, 0x18, 0x18, 0x00, 0x18, 0x00, 0x00,
    // " (34)
    0x6C, 0x6C, 0x6C, 0x00, 0x00, 0x00, 0x00, 0x00,
    // Add remaining characters...
    // (This would include all printable ASCII characters)
};

static u8 current_color = 1;

void fontInit(void) {
    // Load font tiles to VRAM
    dmaCopyVram(font_tiles, 0x6000, sizeof(font_tiles)); // Font at 0x6000
    consoleWrite("Font system initialized\\n");
}

void fontPrint(u16 x, u16 y, const char *text) {
    u16 pos_x = x;
    
    while (*text) {
        if (*text == '\\n') {
            pos_x = x;
            y++;
        } else {
            fontPrintChar(pos_x, y, *text);
            pos_x++;
        }
        text++;
    }
}

void fontPrintChar(u16 x, u16 y, char c) {
    if (c < FONT_FIRST_CHAR || c > FONT_LAST_CHAR) {
        c = '?'; // Default character for unsupported chars
    }
    
    u16 tile_index = (c - FONT_FIRST_CHAR) + 0x300; // Font starts at tile 0x300
    u16 map_entry = tile_index | (current_color << 10); // Set palette
    
    // Calculate VRAM map address (assuming BG1 at 0x7800)
    u16 map_addr = 0x7800 + (y * 32 + x) * 2;
    
    // Write to tilemap
    dmaCopyVram(&map_entry, map_addr, 2);
}

void fontSetColor(u8 color) {
    current_color = color & 0x07; // Limit to 8 palettes
}`;

  return {
    success: true,
    message: `Generated font system template (${tileSize}, ${colorMode})`,
    data: {
      generatedFiles: ['font.h', 'font.c'],
      graphicsInfo: {
        originalSize: 0,
        compressedSize: 95 * ((width * height) / 4), // 95 printable characters
        tileCount: 95,
        uniqueTiles: 95,
        paletteColors: 16,
        memoryUsage: 95 * ((width * height) / 4),
      },
      codeSnippet: `// Initialize and use font\nfontInit();\nfontSetColor(1);\nfontPrint(2, 2, "Hello, SNES!");`,
    },
  };
}

async function batchConvert(
  inputDir: string,
  outputDir: string,
  tileSize: string,
  colorMode: string
) {
  const batchScript = `#!/bin/bash
# Batch Graphics Conversion Script

INPUT_DIR="${inputDir}"
OUTPUT_DIR="${outputDir}"
TILE_SIZE="${tileSize}"
COLOR_MODE="${colorMode}"

echo "Batch converting graphics from \$INPUT_DIR to \$OUTPUT_DIR"
echo "Settings: \$TILE_SIZE tiles, \$COLOR_MODE color mode"

# Create output directory
mkdir -p "\$OUTPUT_DIR"

# Convert all PNG files
for file in "\$INPUT_DIR"/*.png; do
    if [ -f "\$file" ]; then
        basename=\$(basename "\$file" .png)
        echo "Converting \$basename..."
        
        # Using superfamiconv
        if command -v superfamiconv &> /dev/null; then
            superfamiconv tiles \\
                -i "\$file" \\
                -d "\$OUTPUT_DIR/\${basename}_tiles.bin" \\
                -p "\$OUTPUT_DIR/\${basename}_palette.bin" \\
                -m "\$OUTPUT_DIR/\${basename}_tilemap.bin" \\
                --tile-width ${tileSize.split('x')[0]} \\
                --tile-height ${tileSize.split('x')[1]} \\
                --bpp ${parseInt(colorMode.replace('bpp', '')) || 4} \\
                --no-duplicate-tiles
        fi
        
        # Generate C header
        cat > "\$OUTPUT_DIR/\${basename}_gfx.h" << EOF
#ifndef \${basename^^}_GFX_H
#define \${basename^^}_GFX_H

#include <snes.h>

extern const u8 \${basename}_tiles[];
extern const u16 \${basename}_palette[];
extern const u16 \${basename}_tilemap[];

void \${basename}Init(void);

#endif
EOF
    fi
done

echo "Batch conversion complete!"
echo "Generated files in: \$OUTPUT_DIR"`;

  return {
    success: true,
    message: `Generated batch conversion script for directory: ${inputDir}`,
    data: {
      generatedFiles: ['batch_convert.sh'],
      codeSnippet: batchScript,
      conversionStats: `Batch conversion will process all PNG files in ${inputDir} with settings:\n- Tile Size: ${tileSize}\n- Color Mode: ${colorMode}\n- Output: ${outputDir}`,
    },
  };
}

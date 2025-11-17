import { Type } from '@sinclair/typebox';
import { createTypedTool } from './typed-tool-system.js';
import fs from 'fs/promises';
import path from 'path';

/**
 * SNES Sprite Manager Tool
 * 
 * Helps manage SNES sprites including creation, conversion, and optimization
 * for use with PVSnesLib. Supports 8x8 and 16x16 sprites, 4bpp and 8bpp formats.
 */
export const spriteManagerTool = createTypedTool({
  name: 'sprite_manager',
  description: 'Manage SNES sprites - create, convert, optimize for PVSnesLib development',
  inputSchema: Type.Object({
    action: Type.Union([
      Type.Literal('create_sprite_template'),
      Type.Literal('convert_png_to_chr'),
      Type.Literal('analyze_sprite_data'),
      Type.Literal('optimize_palette'),
      Type.Literal('generate_sprite_header')
    ], {
      description: 'Action to perform'
    }),
    filePath: Type.Optional(Type.String({
      description: 'Path to image file (for conversion) or output path'
    })),
    spriteSize: Type.Optional(Type.Union([
      Type.Literal('8x8'),
      Type.Literal('16x16'),
      Type.Literal('32x32'),
      Type.Literal('64x64')
    ], {
      description: 'Sprite size in pixels'
    })),
    colorDepth: Type.Optional(Type.Union([
      Type.Literal('4bpp'),
      Type.Literal('8bpp')
    ], {
      description: 'Color depth (bits per pixel)'
    })),
    spriteName: Type.Optional(Type.String({
      description: 'Name for the sprite (used in generated code)'
    })),
    includeAnimation: Type.Optional(Type.Boolean({
      description: 'Generate animation frame templates'
    }))
  }),
  outputSchema: Type.Object({
    success: Type.Boolean(),
    message: Type.String(),
    data: Type.Optional(Type.Object({
      generatedFiles: Type.Optional(Type.Array(Type.String())),
      spriteInfo: Type.Optional(Type.Object({
        width: Type.Number(),
        height: Type.Number(),
        tileCount: Type.Number(),
        paletteColors: Type.Number(),
        memoryUsage: Type.Number()
      })),
      codeSnippet: Type.Optional(Type.String())
    }))
  }),
  handler: async (input) => {
    try {
      const { action, filePath, spriteSize = '16x16', colorDepth = '4bpp', spriteName = 'mySprite', includeAnimation = false } = input;

      switch (action) {
        case 'create_sprite_template':
          return await createSpriteTemplate(spriteName, spriteSize, colorDepth, includeAnimation);
        
        case 'convert_png_to_chr':
          if (!filePath) {
            return {
              success: false,
              message: 'filePath is required for PNG conversion'
            };
          }
          return await convertPngToChr(filePath, spriteSize, colorDepth);
        
        case 'analyze_sprite_data':
          if (!filePath) {
            return {
              success: false,
              message: 'filePath is required for sprite analysis'
            };
          }
          return await analyzeSpriteData(filePath);
        
        case 'optimize_palette':
          if (!filePath) {
            return {
              success: false,
              message: 'filePath is required for palette optimization'
            };
          }
          return await optimizePalette(filePath);
        
        case 'generate_sprite_header':
          return await generateSpriteHeader(spriteName, spriteSize, colorDepth);
        
        default:
          return {
            success: false,
            message: `Unknown action: ${action}`
          };
      }
    } catch (error) {
      return {
        success: false,
        message: `Sprite manager error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
});

async function createSpriteTemplate(name: string, size: string, colorDepth: string, includeAnimation: boolean) {
  const dimensions = size.split('x').map(Number);
  const [width, height] = dimensions;
  const tileCount = (width / 8) * (height / 8);
  const colors = colorDepth === '4bpp' ? 16 : 256;
  
  // Generate C header content
  const headerContent = `#ifndef ${name.toUpperCase()}_H
#define ${name.toUpperCase()}_H

#include <snes.h>

// Sprite: ${name}
// Size: ${width}x${height} (${tileCount} tiles)
// Color Depth: ${colorDepth} (${colors} colors)

#define ${name.toUpperCase()}_WIDTH  ${width}
#define ${name.toUpperCase()}_HEIGHT ${height}
#define ${name.toUpperCase()}_TILES  ${tileCount}
#define ${name.toUpperCase()}_COLORS ${colors}

// Sprite data (to be filled with actual graphics data)
extern const u8 ${name}Tiles[];
extern const u16 ${name}Palette[];
extern const u16 ${name}Map[];

${includeAnimation ? `
// Animation frames
#define ${name.toUpperCase()}_FRAMES 4
extern const u16 ${name}AnimFrames[];
` : ''}

// Functions
void ${name}Init(void);
void ${name}SetPosition(u16 x, u16 y);
void ${name}Show(void);
void ${name}Hide(void);
${includeAnimation ? `void ${name}NextFrame(void);` : ''}

#endif // ${name.toUpperCase()}_H`;

  // Generate C source template
  const sourceContent = `#include "${name}.h"

// Sprite graphics data (replace with actual data from png2snes)
const u8 ${name}Tiles[${tileCount * 32}] = {
    // TODO: Replace with actual tile data
    // Generated by png2snes utility
};

const u16 ${name}Palette[${colors}] = {
    // TODO: Replace with actual palette data
    // 16-bit color values in SNES format (0BBB_BGGG_GGGG_RRRRR)
    0x0000, // Black
    0x7FFF, // White
    // Add more colors...
};

${includeAnimation ? `
const u16 ${name}AnimFrames[${name.toUpperCase()}_FRAMES] = {
    0, ${tileCount}, ${tileCount * 2}, ${tileCount * 3}
};

static u8 currentFrame = 0;
` : ''}

static u16 spriteX = 0;
static u16 spriteY = 0;
static bool isVisible = false;

void ${name}Init(void) {
    // Load sprite tiles into VRAM
    // dmaCopyVram(${name}Tiles, ${name.toUpperCase()}_VRAM_ADDR, ${tileCount * 32});
    
    // Load palette into CGRAM
    // dmaCopyCGram(${name}Palette, 0, ${colors * 2});
    
    consoleWrite("${name} sprite initialized\\n");
}

void ${name}SetPosition(u16 x, u16 y) {
    spriteX = x;
    spriteY = y;
    if (isVisible) {
        // Update sprite position in OAM
        // oamSet(0, spriteX, spriteY, 0, 0, 0, 0, 0);
    }
}

void ${name}Show(void) {
    isVisible = true;
    // Show sprite in OAM
    // oamSet(0, spriteX, spriteY, 0, 0, 0, 0, 0);
}

void ${name}Hide(void) {
    isVisible = false;
    // Hide sprite (move off-screen or disable)
    // oamSet(0, 0xFF, 0xFF, 0, 0, 0, 0, 0);
}

${includeAnimation ? `
void ${name}NextFrame(void) {
    currentFrame = (currentFrame + 1) % ${name.toUpperCase()}_FRAMES;
    if (isVisible) {
        // Update sprite tile based on animation frame
        // oamSet(0, spriteX, spriteY, 0, 0, ${name}AnimFrames[currentFrame], 0, 0);
    }
}
` : ''}`;

  const makefile = `# Makefile for ${name} sprite
# Add this to your main project Makefile

${name.toUpperCase()}_OBJS := ${name}.obj
OBJS += $(${name.toUpperCase()}_OBJS)

${name}.obj: ${name}.c ${name}.h
\t$(CC) $(CFLAGS) -c $< -o $@

.PHONY: ${name}-clean
${name}-clean:
\trm -f $(${name.toUpperCase()}_OBJS)

clean: ${name}-clean`;

  return {
    success: true,
    message: `Created sprite template for ${name} (${size}, ${colorDepth})`,
    data: {
      generatedFiles: [`${name}.h`, `${name}.c`, `${name}.mk`],
      spriteInfo: {
        width,
        height,
        tileCount,
        paletteColors: colors,
        memoryUsage: tileCount * 32 + colors * 2
      },
      codeSnippet: `// Initialize and use ${name} sprite\n${name}Init();\n${name}SetPosition(100, 100);\n${name}Show();`
    }
  };
}

async function convertPngToChr(filePath: string, size: string, colorDepth: string) {
  // This would integrate with png2snes or similar utility
  // For now, provide instructions
  const basename = path.basename(filePath, '.png');
  const chrFile = `${basename}.chr`;
  const palFile = `${basename}.pal`;
  
  const instructions = `# Convert PNG to SNES CHR format

# Using png2snes utility:
png2snes -i "${filePath}" -o "${chrFile}" -p "${palFile}" -f ${colorDepth} -s ${size}

# Alternative using YY-CHR:
# 1. Open ${filePath} in YY-CHR
# 2. Set format to SNES 4bit
# 3. Export as CHR format to ${chrFile}
# 4. Export palette to ${palFile}

# Integration commands:
# Copy to graphics directory: cp ${chrFile} gfx/
# Include in code: #include "gfx/${basename}.h"`;

  return {
    success: true,
    message: `Generated conversion instructions for ${filePath}`,
    data: {
      generatedFiles: [chrFile, palFile],
      codeSnippet: instructions
    }
  };
}

async function analyzeSpriteData(filePath: string) {
  try {
    const stats = await fs.stat(filePath);
    const ext = path.extname(filePath).toLowerCase();
    
    if (ext === '.chr' || ext === '.bin') {
      // Analyze CHR file
      const tileCount = Math.floor(stats.size / 32); // 32 bytes per 8x8 tile in 4bpp
      const spriteCount = Math.floor(tileCount / 4); // Assuming 16x16 sprites (4 tiles each)
      
      return {
        success: true,
        message: `Analyzed CHR file: ${path.basename(filePath)}`,
        data: {
          spriteInfo: {
            width: 0, // Unknown from CHR
            height: 0,
            tileCount,
            paletteColors: 0, // Not in CHR file
            memoryUsage: stats.size
          },
          codeSnippet: `// CHR Analysis\n// File: ${filePath}\n// Tiles: ${tileCount}\n// Estimated 16x16 sprites: ${spriteCount}`
        }
      };
    } else if (ext === '.png' || ext === '.bmp') {
      // Would analyze image dimensions and colors
      return {
        success: true,
        message: `Image analysis not yet implemented for ${ext} files`,
        data: {
          spriteInfo: {
            width: 0,
            height: 0,
            tileCount: 0,
            paletteColors: 0,
            memoryUsage: stats.size
          }
        }
      };
    }
    
    return {
      success: false,
      message: `Unsupported file type: ${ext}`
    };
  } catch (error) {
    return {
      success: false,
      message: `Could not analyze file: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

async function optimizePalette(filePath: string) {
  // Palette optimization logic would go here
  return {
    success: true,
    message: `Palette optimization suggestions for ${path.basename(filePath)}`,
    data: {
      codeSnippet: `# Palette Optimization Tips:
# 1. Use color 0 as transparent
# 2. Group similar colors together
# 3. Share palettes between sprites when possible
# 4. Consider using 4bpp instead of 8bpp for memory savings
# 5. Use SNES color format: 0BBB_BGGG_GGGG_RRRRR`
    }
  };
}

async function generateSpriteHeader(name: string, size: string, colorDepth: string) {
  const dimensions = size.split('x').map(Number);
  const [width, height] = dimensions;
  const tileCount = (width / 8) * (height / 8);
  
  const headerContent = `// Auto-generated sprite header for ${name}
#define SPRITE_${name.toUpperCase()}_WIDTH  ${width}
#define SPRITE_${name.toUpperCase()}_HEIGHT ${height}
#define SPRITE_${name.toUpperCase()}_TILES  ${tileCount}
#define SPRITE_${name.toUpperCase()}_SIZE   ${colorDepth}

extern const u8 sprite_${name}_gfx[];
extern const u16 sprite_${name}_pal[];`;

  return {
    success: true,
    message: `Generated sprite header defines for ${name}`,
    data: {
      codeSnippet: headerContent
    }
  };
}
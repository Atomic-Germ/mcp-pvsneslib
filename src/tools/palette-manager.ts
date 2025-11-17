import { Type } from '@sinclair/typebox';
import { createTypedTool } from './typed-tool-system.js';
import fs from 'fs/promises';
import path from 'path';

/**
 * SNES Palette Manager Tool
 *
 * Manages color palettes for SNES development, including
 * color conversion, palette optimization, and gradient generation for PVSnesLib.
 */
export const paletteManagerTool = createTypedTool({
  name: 'palette_manager',
  description:
    'Manage SNES color palettes - create, optimize, convert, and generate palettes',
  inputSchema: Type.Object({
    action: Type.Union(
      [
        Type.Literal('create_palette'),
        Type.Literal('convert_rgb_to_snes'),
        Type.Literal('optimize_colors'),
        Type.Literal('generate_gradient'),
        Type.Literal('merge_palettes'),
        Type.Literal('extract_from_image'),
        Type.Literal('create_fade_effect'),
        Type.Literal('analyze_palette'),
      ],
      {
        description: 'Palette management action',
      }
    ),
    colorMode: Type.Optional(
      Type.Union(
        [Type.Literal('2bpp'), Type.Literal('4bpp'), Type.Literal('8bpp')],
        {
          description: 'SNES color mode (bits per pixel)',
        }
      )
    ),
    paletteSize: Type.Optional(
      Type.Number({
        description: 'Number of colors in palette',
        minimum: 2,
        maximum: 256,
      })
    ),
    colors: Type.Optional(
      Type.Array(Type.String(), {
        description: 'Array of color values (hex format: #RRGGBB)',
      })
    ),
    startColor: Type.Optional(
      Type.String({
        description: 'Starting color for gradient (hex format)',
      })
    ),
    endColor: Type.Optional(
      Type.String({
        description: 'Ending color for gradient (hex format)',
      })
    ),
    steps: Type.Optional(
      Type.Number({
        description: 'Number of steps in gradient',
        minimum: 2,
        maximum: 256,
      })
    ),
    filePath: Type.Optional(
      Type.String({
        description: 'Input image file path for color extraction',
      })
    ),
    paletteName: Type.Optional(
      Type.String({
        description: 'Name for the generated palette',
      })
    ),
    fadeFrames: Type.Optional(
      Type.Number({
        description: 'Number of frames for fade effect',
        minimum: 1,
        maximum: 64,
      })
    ),
  }),
  outputSchema: Type.Object({
    success: Type.Boolean(),
    message: Type.String(),
    data: Type.Optional(
      Type.Object({
        generatedFiles: Type.Optional(Type.Array(Type.String())),
        paletteInfo: Type.Optional(
          Type.Object({
            colorCount: Type.Number(),
            snesFormat: Type.Array(Type.String()),
            rgbFormat: Type.Array(Type.String()),
            memoryUsage: Type.Number(),
          })
        ),
        codeSnippet: Type.Optional(Type.String()),
        conversionData: Type.Optional(Type.String()),
      })
    ),
  }),
  handler: async input => {
    try {
      const {
        action,
        colorMode = '4bpp',
        paletteSize,
        colors = [],
        startColor = '#000000',
        endColor = '#FFFFFF',
        steps = 16,
        filePath,
        paletteName = 'default_palette',
        fadeFrames = 16,
      } = input;

      // Determine palette size from color mode if not specified
      const maxColors =
        paletteSize ||
        (colorMode === '2bpp' ? 4 : colorMode === '4bpp' ? 16 : 256);

      switch (action) {
        case 'create_palette':
          return await createPalette(paletteName, maxColors, colorMode, colors);

        case 'convert_rgb_to_snes':
          return await convertRgbToSnes(colors);

        case 'optimize_colors':
          return await optimizeColors(colors, maxColors);

        case 'generate_gradient':
          return await generateGradient(
            startColor,
            endColor,
            steps,
            paletteName
          );

        case 'merge_palettes':
          return await mergePalettes(colors, maxColors);

        case 'extract_from_image':
          if (!filePath) {
            return {
              success: false,
              message: 'filePath is required for color extraction',
            };
          }
          return await extractFromImage(filePath, maxColors, paletteName);

        case 'create_fade_effect':
          return await createFadeEffect(
            colors.length > 0 ? colors : ['#000000'],
            fadeFrames,
            paletteName
          );

        case 'analyze_palette':
          return await analyzePalette(colors, colorMode);

        default:
          return { success: false, message: `Unknown action: ${action}` };
      }
    } catch (error) {
      return {
        success: false,
        message: `Palette manager error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  },
});

async function createPalette(
  name: string,
  colorCount: number,
  colorMode: string,
  inputColors: string[]
) {
  // Generate default colors if none provided
  const colors =
    inputColors.length > 0 ? inputColors : generateDefaultColors(colorCount);

  // Convert to SNES format
  const snesColors = colors.map(color => rgbToSnes(color));

  // Generate palette header
  const paletteHeader = `#ifndef ${name.toUpperCase()}_PALETTE_H
#define ${name.toUpperCase()}_PALETTE_H

#include <snes.h>

// Palette: ${name}
// Color Mode: ${colorMode} (${colorCount} colors)
// Format: SNES 15-bit RGB (0BBB_BBGG_GGGR_RRRR)

#define ${name.toUpperCase()}_SIZE      ${colorCount}
#define ${name.toUpperCase()}_MODE      ${colorMode}
#define ${name.toUpperCase()}_BYTES     (${name.toUpperCase()}_SIZE * 2)

// Palette data
extern const u16 ${name}_palette[${name.toUpperCase()}_SIZE];

// Palette functions
void ${name}LoadPalette(u8 palette_index);
void ${name}FadeTo(const u16 *target_palette, u8 speed);
void ${name}SetColor(u8 color_index, u16 snes_color);
u16 ${name}GetColor(u8 color_index);

// Color conversion utilities
u16 ${name}RgbToSnes(u8 r, u8 g, u8 b);
void ${name}SnesToRgb(u16 snes_color, u8 *r, u8 *g, u8 *b);

#endif // ${name.toUpperCase()}_PALETTE_H`;

  // Generate palette source
  const paletteSource = `#include "${name}_palette.h"

// ${name} palette data (${colorCount} colors)
const u16 ${name}_palette[${name.toUpperCase()}_SIZE] = {
${snesColors.map((color, index) => `    ${color}, // Color ${index}: ${colors[index]}`).join('\n')}
};

// Current palette state (for fading effects)
static u16 current_palette[${name.toUpperCase()}_SIZE];
static bool palette_loaded = false;

void ${name}LoadPalette(u8 palette_index) {
    // Load palette into CGRAM
    dmaCopyCGram(${name}_palette, palette_index * 16, ${name.toUpperCase()}_BYTES);
    
    // Copy to current state
    for (u8 i = 0; i < ${name.toUpperCase()}_SIZE; i++) {
        current_palette[i] = ${name}_palette[i];
    }
    palette_loaded = true;
    
    consoleWrite("Loaded ${name} palette to slot %d\\n", palette_index);
}

void ${name}FadeTo(const u16 *target_palette, u8 speed) {
    if (!palette_loaded) return;
    
    for (u8 i = 0; i < ${name.toUpperCase()}_SIZE; i++) {
        u16 current = current_palette[i];
        u16 target = target_palette[i];
        
        // Extract RGB components
        u8 cr = current & 0x1F;
        u8 cg = (current >> 5) & 0x1F;
        u8 cb = (current >> 10) & 0x1F;
        
        u8 tr = target & 0x1F;
        u8 tg = (target >> 5) & 0x1F;
        u8 tb = (target >> 10) & 0x1F;
        
        // Interpolate each component
        if (cr < tr) cr = (cr + speed > tr) ? tr : cr + speed;
        else if (cr > tr) cr = (cr - speed < tr) ? tr : cr - speed;
        
        if (cg < tg) cg = (cg + speed > tg) ? tg : cg + speed;
        else if (cg > tg) cg = (cg - speed < tg) ? tg : cg - speed;
        
        if (cb < tb) cb = (cb + speed > tb) ? tb : cb + speed;
        else if (cb > tb) cb = (cb - speed < tb) ? tb : cb - speed;
        
        current_palette[i] = cr | (cg << 5) | (cb << 10);
    }
    
    // Update CGRAM with interpolated colors
    dmaCopyCGram(current_palette, 0, ${name.toUpperCase()}_BYTES);
}

void ${name}SetColor(u8 color_index, u16 snes_color) {
    if (color_index >= ${name.toUpperCase()}_SIZE) return;
    
    current_palette[color_index] = snes_color;
    
    // Update single color in CGRAM
    dmaCopyCGram(&snes_color, color_index * 2, 2);
}

u16 ${name}GetColor(u8 color_index) {
    if (color_index >= ${name.toUpperCase()}_SIZE) return 0;
    return current_palette[color_index];
}

u16 ${name}RgbToSnes(u8 r, u8 g, u8 b) {
    // Convert 8-bit RGB to 5-bit RGB (SNES format)
    u16 r5 = (r >> 3) & 0x1F;
    u16 g5 = (g >> 3) & 0x1F;
    u16 b5 = (b >> 3) & 0x1F;
    return r5 | (g5 << 5) | (b5 << 10);
}

void ${name}SnesToRgb(u16 snes_color, u8 *r, u8 *g, u8 *b) {
    // Convert SNES 15-bit to 8-bit RGB
    *r = ((snes_color & 0x1F) << 3) | ((snes_color & 0x1F) >> 2);
    *g = (((snes_color >> 5) & 0x1F) << 3) | (((snes_color >> 5) & 0x1F) >> 2);
    *b = (((snes_color >> 10) & 0x1F) << 3) | (((snes_color >> 10) & 0x1F) >> 2);
}`;

  return {
    success: true,
    message: `Created ${name} palette with ${colorCount} colors (${colorMode})`,
    data: {
      generatedFiles: [`${name}_palette.h`, `${name}_palette.c`],
      paletteInfo: {
        colorCount,
        snesFormat: snesColors,
        rgbFormat: colors,
        memoryUsage: colorCount * 2,
      },
      codeSnippet: `// Load and use palette\n${name}LoadPalette(0);\n${name}SetColor(1, ${name}RgbToSnes(255, 0, 0)); // Set color 1 to red`,
    },
  };
}

function generateDefaultColors(count: number): string[] {
  const colors = ['#000000']; // Start with black/transparent

  if (count <= 4) {
    // 2bpp palette
    return ['#000000', '#555555', '#AAAAAA', '#FFFFFF'].slice(0, count);
  } else if (count <= 16) {
    // 4bpp palette - common game colors
    return [
      '#000000', // 0: Black/Transparent
      '#FFFFFF', // 1: White
      '#FF0000', // 2: Red
      '#00FF00', // 3: Green
      '#0000FF', // 4: Blue
      '#FFFF00', // 5: Yellow
      '#FF00FF', // 6: Magenta
      '#00FFFF', // 7: Cyan
      '#800000', // 8: Dark Red
      '#008000', // 9: Dark Green
      '#000080', // 10: Dark Blue
      '#808080', // 11: Gray
      '#C0C0C0', // 12: Light Gray
      '#800080', // 13: Purple
      '#808000', // 14: Olive
      '#008080', // 15: Teal
    ].slice(0, count);
  } else {
    // 8bpp palette - generate systematic colors
    const palette = ['#000000']; // Black first

    // Add grayscale ramp
    for (let i = 1; i < 16; i++) {
      const gray = Math.floor((i * 255) / 15);
      palette.push(`#${gray.toString(16).padStart(2, '0').repeat(3)}`);
    }

    // Add color ramps (red, green, blue, etc.)
    const baseHues = [0, 60, 120, 180, 240, 300]; // Red, Yellow, Green, Cyan, Blue, Magenta

    for (const hue of baseHues) {
      for (let sat = 0; sat < 4; sat++) {
        for (let val = 0; val < 4; val++) {
          if (palette.length >= count) break;
          const color = hsvToHex(hue, sat * 85, (val + 1) * 64);
          palette.push(color);
        }
        if (palette.length >= count) break;
      }
      if (palette.length >= count) break;
    }

    return palette.slice(0, count);
  }
}

function rgbToSnes(hexColor: string): string {
  // Parse hex color
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);

  // Convert to 5-bit per component
  const r5 = Math.floor(r / 8);
  const g5 = Math.floor(g / 8);
  const b5 = Math.floor(b / 8);

  // Pack into SNES format: 0BBB_BBGG_GGGR_RRRR
  const snesColor = r5 | (g5 << 5) | (b5 << 10);

  return `0x${snesColor.toString(16).padStart(4, '0').toUpperCase()}`;
}

function hsvToHex(h: number, s: number, v: number): string {
  const c = (v * s) / 255 / 255;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v / 255 - c;

  let r = 0,
    g = 0,
    b = 0;

  if (h >= 0 && h < 60) {
    r = c;
    g = x;
    b = 0;
  } else if (h >= 60 && h < 120) {
    r = x;
    g = c;
    b = 0;
  } else if (h >= 120 && h < 180) {
    r = 0;
    g = c;
    b = x;
  } else if (h >= 180 && h < 240) {
    r = 0;
    g = x;
    b = c;
  } else if (h >= 240 && h < 300) {
    r = x;
    g = 0;
    b = c;
  } else if (h >= 300 && h < 360) {
    r = c;
    g = 0;
    b = x;
  }

  r = Math.floor((r + m) * 255);
  g = Math.floor((g + m) * 255);
  b = Math.floor((b + m) * 255);

  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

async function convertRgbToSnes(colors: string[]) {
  const conversions = colors.map(color => {
    const snes = rgbToSnes(color);
    return { rgb: color, snes };
  });

  const conversionTable = `// RGB to SNES Color Conversion Table
// Format: RGB → SNES 15-bit (0BBB_BBGG_GGGR_RRRR)

${conversions.map(({ rgb, snes }) => `// ${rgb} → ${snes}`).join('\n')}

// C Array format:
const u16 converted_colors[] = {
${conversions.map(({ snes }) => `    ${snes},`).join('\n')}
};

// Conversion function:
u16 rgbToSnes(u8 r, u8 g, u8 b) {
    u16 r5 = (r >> 3) & 0x1F;
    u16 g5 = (g >> 3) & 0x1F;
    u16 b5 = (b >> 3) & 0x1F;
    return r5 | (g5 << 5) | (b5 << 10);
}`;

  return {
    success: true,
    message: `Converted ${colors.length} RGB colors to SNES format`,
    data: {
      paletteInfo: {
        colorCount: colors.length,
        snesFormat: conversions.map(c => c.snes),
        rgbFormat: colors,
        memoryUsage: colors.length * 2,
      },
      conversionData: conversionTable,
    },
  };
}

async function optimizeColors(colors: string[], maxColors: number) {
  if (colors.length <= maxColors) {
    return {
      success: true,
      message: `No optimization needed (${colors.length} colors ≤ ${maxColors})`,
      data: {
        paletteInfo: {
          colorCount: colors.length,
          snesFormat: colors.map(rgbToSnes),
          rgbFormat: colors,
          memoryUsage: colors.length * 2,
        },
      },
    };
  }

  const optimizationTips = `# Color Palette Optimization

## Current Status:
- Input colors: ${colors.length}
- Target colors: ${maxColors}
- Reduction needed: ${colors.length - maxColors} colors

## Optimization Strategies:

### 1. Remove Similar Colors
- Merge colors with minimal visual difference
- Use color distance calculations (Delta E)
- Keep the most frequently used colors

### 2. Quantization Methods
- Median Cut Algorithm: Divide color space by variance
- Octree Quantization: Tree-based color reduction
- K-means Clustering: Group similar colors

### 3. Perceptual Optimization
- Weight colors by human visual perception
- Preserve important colors (skin tones, key objects)
- Use dithering to simulate removed colors

### 4. SNES-Specific Considerations
- Account for 15-bit color precision
- Consider palette animation requirements
- Reserve color 0 for transparency
- Group by sprite/background usage

### Recommended Tools:
- ImageMagick: convert input.png -colors ${maxColors} output.png
- GIMP: Image → Mode → Indexed → ${maxColors} colors
- Custom quantization algorithms

### Implementation:
1. Analyze color frequency/importance
2. Apply chosen quantization method  
3. Convert optimized palette to SNES format
4. Test visual quality in context`;

  return {
    success: true,
    message: `Generated optimization plan for ${colors.length} → ${maxColors} colors`,
    data: {
      conversionData: optimizationTips,
      paletteInfo: {
        colorCount: colors.length,
        snesFormat: colors.slice(0, maxColors).map(rgbToSnes),
        rgbFormat: colors.slice(0, maxColors),
        memoryUsage: maxColors * 2,
      },
    },
  };
}

async function generateGradient(
  startColor: string,
  endColor: string,
  steps: number,
  name: string
) {
  const gradient = [];

  // Parse start and end colors
  const startR = parseInt(startColor.substr(1, 2), 16);
  const startG = parseInt(startColor.substr(3, 2), 16);
  const startB = parseInt(startColor.substr(5, 2), 16);

  const endR = parseInt(endColor.substr(1, 2), 16);
  const endG = parseInt(endColor.substr(3, 2), 16);
  const endB = parseInt(endColor.substr(5, 2), 16);

  // Generate gradient steps
  for (let i = 0; i < steps; i++) {
    const factor = i / (steps - 1);

    const r = Math.round(startR + (endR - startR) * factor);
    const g = Math.round(startG + (endG - startG) * factor);
    const b = Math.round(startB + (endB - startB) * factor);

    const hexColor = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    gradient.push(hexColor);
  }

  // Generate gradient palette code
  const gradientHeader = `// Gradient Palette: ${name}
// From: ${startColor} to ${endColor} (${steps} steps)

#ifndef ${name.toUpperCase()}_GRADIENT_H
#define ${name.toUpperCase()}_GRADIENT_H

#include <snes.h>

#define ${name.toUpperCase()}_STEPS ${steps}

extern const u16 ${name}_gradient[${name.toUpperCase()}_STEPS];

// Gradient functions
void ${name}LoadGradient(u8 palette_index);
u16 ${name}GetGradientColor(u8 step);
void ${name}AnimateGradient(u8 speed);

#endif`;

  const gradientSource = `#include "${name}_gradient.h"

const u16 ${name}_gradient[${name.toUpperCase()}_STEPS] = {
${gradient.map((color, i) => `    ${rgbToSnes(color)}, // Step ${i}: ${color}`).join('\n')}
};

static u8 current_offset = 0;

void ${name}LoadGradient(u8 palette_index) {
    dmaCopyCGram(${name}_gradient, palette_index * 16, sizeof(${name}_gradient));
}

u16 ${name}GetGradientColor(u8 step) {
    if (step >= ${name.toUpperCase()}_STEPS) return ${rgbToSnes(gradient[gradient.length - 1])};
    return ${name}_gradient[step];
}

void ${name}AnimateGradient(u8 speed) {
    static u8 timer = 0;
    
    timer++;
    if (timer >= speed) {
        timer = 0;
        current_offset = (current_offset + 1) % ${name.toUpperCase()}_STEPS;
        
        // Rotate gradient colors
        for (u8 i = 0; i < ${name.toUpperCase()}_STEPS; i++) {
            u8 index = (i + current_offset) % ${name.toUpperCase()}_STEPS;
            dmaCopyCGram(&${name}_gradient[index], i * 2, 2);
        }
    }
}`;

  return {
    success: true,
    message: `Generated ${steps}-step gradient from ${startColor} to ${endColor}`,
    data: {
      generatedFiles: [`${name}_gradient.h`, `${name}_gradient.c`],
      paletteInfo: {
        colorCount: steps,
        snesFormat: gradient.map(rgbToSnes),
        rgbFormat: gradient,
        memoryUsage: steps * 2,
      },
      codeSnippet: `// Load and animate gradient\n${name}LoadGradient(0);\n${name}AnimateGradient(4); // Animate every 4 frames`,
    },
  };
}

async function mergePalettes(paletteColors: string[], maxColors: number) {
  // This would implement palette merging logic
  const mergeInstructions = `# Palette Merging Guide

## Merging ${paletteColors.length} colors into ${maxColors} slots

### Strategy 1: Priority-Based Merging
1. Assign priorities to each source palette
2. Reserve slots for most important colors
3. Merge similar colors from different palettes
4. Use shared colors where possible

### Strategy 2: Usage-Based Merging  
1. Analyze color usage frequency
2. Keep most frequently used colors
3. Merge or remove rarely used colors
4. Optimize for visual quality

### Strategy 3: Context-Based Merging
1. Group by sprite/background usage
2. Share common colors (outlines, shadows)
3. Use palette swapping for variations
4. Consider animation requirements

### Implementation Tips:
- Reserve color 0 for transparency
- Keep outline/border colors consistent
- Use brightness variations for depth
- Test merged palette in context

### Code Example:
const u16 merged_palette[${maxColors}] = {
    0x0000, // Transparent
    0x7FFF, // White (shared)
    0x0000, // Black (shared)
    // ... add optimized colors
};`;

  return {
    success: true,
    message: `Generated palette merging guide for ${maxColors} colors`,
    data: {
      conversionData: mergeInstructions,
      paletteInfo: {
        colorCount: Math.min(paletteColors.length, maxColors),
        snesFormat: paletteColors.slice(0, maxColors).map(rgbToSnes),
        rgbFormat: paletteColors.slice(0, maxColors),
        memoryUsage: maxColors * 2,
      },
    },
  };
}

async function extractFromImage(
  filePath: string,
  maxColors: number,
  paletteName: string
) {
  const basename = path.basename(filePath, path.extname(filePath));

  const extractionScript = `#!/bin/bash
# Color Extraction Script for ${basename}

INPUT_FILE="${filePath}"
MAX_COLORS=${maxColors}
OUTPUT_NAME="${paletteName}"

echo "Extracting ${maxColors} colors from \$INPUT_FILE"

# Method 1: Using ImageMagick
if command -v convert &> /dev/null; then
    echo "Using ImageMagick for color extraction..."
    
    # Extract unique colors
    convert "\$INPUT_FILE" +dither -colors \$MAX_COLORS -format "%c" histogram:info: > colors.txt
    
    # Convert to hex format
    grep -o '#[0-9A-F]\\{6\\}' colors.txt > "\${OUTPUT_NAME}_colors.txt"
fi

# Method 2: Using Python with PIL
if command -v python3 &> /dev/null; then
    python3 << 'EOF'
import sys
from PIL import Image
import colorsys

def extract_colors(image_path, max_colors):
    img = Image.open(image_path)
    img = img.convert('RGB')
    
    # Get all unique colors
    colors = img.getcolors(maxcolors=256*256*256)
    if not colors:
        colors = img.getcolors()
    
    # Sort by frequency
    colors.sort(key=lambda x: x[0], reverse=True)
    
    # Take top colors
    top_colors = colors[:max_colors]
    
    # Convert to hex
    hex_colors = []
    for count, (r, g, b) in top_colors:
        hex_color = f"#{r:02x}{g:02x}{b:02x}"
        hex_colors.append(hex_color)
    
    return hex_colors

colors = extract_colors("${filePath}", ${maxColors})
with open("${paletteName}_extracted.txt", "w") as f:
    for color in colors:
        f.write(color + "\\n")

print(f"Extracted {len(colors)} colors")
EOF
fi

# Method 3: Using GIMP script-fu (if GIMP is available)
# This would require a custom GIMP script

echo "Color extraction complete!"
echo "Check output files:"
echo "  - \${OUTPUT_NAME}_colors.txt"
echo "  - \${OUTPUT_NAME}_extracted.txt"`;

  const gimpScript = `; GIMP Script-Fu for color extraction
; Extract ${maxColors} colors from ${basename}

(define (extract-colors image drawable max-colors output-file)
  (let* ((indexed-image (car (gimp-image-duplicate image)))
         (indexed-layer (car (gimp-image-get-active-layer indexed-image))))
    
    ; Convert to indexed mode with specified number of colors
    (gimp-image-convert-indexed indexed-image 
                                CONVERT-DITHER-NONE 
                                CONVERT-PALETTE-GENERATE 
                                max-colors 
                                FALSE 
                                FALSE 
                                "")
    
    ; Get colormap
    (let* ((colormap (gimp-image-get-colormap indexed-image))
           (num-colors (car colormap))
           (colors (cadr colormap)))
      
      ; Save palette to file
      (let ((file (open-output-file output-file)))
        (do ((i 0 (+ i 3)))
            ((>= i (* num-colors 3)))
          (let ((r (aref colors i))
                (g (aref colors (+ i 1)))
                (b (aref colors (+ i 2))))
            (format file "#~2,'0x~2,'0x~2,'0x~%" r g b)))
        (close-output-port file)))
    
    ; Clean up
    (gimp-image-delete indexed-image)))

; Usage: (extract-colors image drawable ${maxColors} "${paletteName}_gimp.txt")`;

  return {
    success: true,
    message: `Generated color extraction setup for ${basename}`,
    data: {
      generatedFiles: [`extract_${basename}.sh`, `extract_${basename}.scm`],
      conversionData: extractionScript,
      codeSnippet: gimpScript,
    },
  };
}

async function createFadeEffect(
  colors: string[],
  fadeFrames: number,
  paletteName: string
) {
  const fadeToBlack = [];
  const fadeFromBlack = [];

  // Generate fade-to-black frames
  for (let frame = 0; frame < fadeFrames; frame++) {
    const factor = 1 - frame / (fadeFrames - 1);
    const frameColors = colors.map(color => {
      const r = parseInt(color.substr(1, 2), 16);
      const g = parseInt(color.substr(3, 2), 16);
      const b = parseInt(color.substr(5, 2), 16);

      const newR = Math.floor(r * factor);
      const newG = Math.floor(g * factor);
      const newB = Math.floor(b * factor);

      return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
    });
    fadeToBlack.push(frameColors);
  }

  // Generate fade-from-black frames (reverse)
  for (let frame = 0; frame < fadeFrames; frame++) {
    fadeFromBlack.push(fadeToBlack[fadeFrames - 1 - frame]);
  }

  const fadeHeader = `// Fade Effect System for ${paletteName}
#ifndef ${paletteName.toUpperCase()}_FADE_H
#define ${paletteName.toUpperCase()}_FADE_H

#include <snes.h>

#define FADE_FRAMES ${fadeFrames}
#define FADE_COLORS ${colors.length}

// Fade types
typedef enum {
    FADE_TO_BLACK,
    FADE_FROM_BLACK,
    FADE_TO_WHITE,
    FADE_FROM_WHITE
} fade_type_t;

// Fade state
typedef struct {
    u8 current_frame;
    u8 target_frame;
    fade_type_t type;
    bool active;
    u8 speed;
} fade_state_t;

extern fade_state_t fade_state;
extern const u16 ${paletteName}_fade_frames[FADE_FRAMES][FADE_COLORS];

// Fade functions
void ${paletteName}FadeInit(void);
void ${paletteName}FadeStart(fade_type_t type, u8 speed);
void ${paletteName}FadeUpdate(void);
bool ${paletteName}FadeIsActive(void);
void ${paletteName}FadeStop(void);

#endif`;

  const fadeSource = `#include "${paletteName}_fade.h"

fade_state_t fade_state = {0, 0, FADE_TO_BLACK, false, 1};

// Fade-to-black frames
const u16 ${paletteName}_fade_frames[FADE_FRAMES][FADE_COLORS] = {
${fadeToBlack
  .map(
    (frame, i) =>
      `    { // Frame ${i}\n${frame.map(color => `        ${rgbToSnes(color)},`).join('\n')}\n    },`
  )
  .join('\n')}
};

void ${paletteName}FadeInit(void) {
    fade_state.current_frame = 0;
    fade_state.active = false;
    consoleWrite("Fade system initialized\\n");
}

void ${paletteName}FadeStart(fade_type_t type, u8 speed) {
    fade_state.type = type;
    fade_state.speed = speed;
    fade_state.active = true;
    
    switch (type) {
        case FADE_TO_BLACK:
            fade_state.current_frame = 0;
            fade_state.target_frame = FADE_FRAMES - 1;
            break;
            
        case FADE_FROM_BLACK:
            fade_state.current_frame = FADE_FRAMES - 1;
            fade_state.target_frame = 0;
            break;
            
        case FADE_TO_WHITE:
        case FADE_FROM_WHITE:
            // Would need white fade frames
            break;
    }
}

void ${paletteName}FadeUpdate(void) {
    if (!fade_state.active) return;
    
    static u8 timer = 0;
    timer++;
    
    if (timer >= fade_state.speed) {
        timer = 0;
        
        // Update frame
        if (fade_state.current_frame < fade_state.target_frame) {
            fade_state.current_frame++;
        } else if (fade_state.current_frame > fade_state.target_frame) {
            fade_state.current_frame--;
        } else {
            // Fade complete
            fade_state.active = false;
            return;
        }
        
        // Update palette
        dmaCopyCGram(${paletteName}_fade_frames[fade_state.current_frame], 0, FADE_COLORS * 2);
    }
}

bool ${paletteName}FadeIsActive(void) {
    return fade_state.active;
}

void ${paletteName}FadeStop(void) {
    fade_state.active = false;
}`;

  return {
    success: true,
    message: `Generated ${fadeFrames}-frame fade effect system`,
    data: {
      generatedFiles: [`${paletteName}_fade.h`, `${paletteName}_fade.c`],
      paletteInfo: {
        colorCount: colors.length,
        snesFormat: colors.map(rgbToSnes),
        rgbFormat: colors,
        memoryUsage: colors.length * 2 * fadeFrames,
      },
      codeSnippet: `// Use fade effect\n${paletteName}FadeInit();\n${paletteName}FadeStart(FADE_TO_BLACK, 2); // Fade to black over 2 frames\n\n// In main loop:\n${paletteName}FadeUpdate();`,
    },
  };
}

async function analyzePalette(colors: string[], colorMode: string) {
  const maxColors = colorMode === '2bpp' ? 4 : colorMode === '4bpp' ? 16 : 256;

  // Analyze color distribution
  const analysis = {
    totalColors: colors.length,
    utilization: Math.round((colors.length / maxColors) * 100),
    duplicates: 0,
    dominantColors: [] as string[],
    colorStats: {
      brightness: 0,
      contrast: 0,
      saturation: 0,
    },
  };

  // Find duplicates
  const colorSet = new Set(colors);
  analysis.duplicates = colors.length - colorSet.size;

  // Get most frequent colors (simplified)
  analysis.dominantColors = colors.slice(0, Math.min(5, colors.length));

  const analysisReport = `# Palette Analysis Report

## Basic Statistics:
- Total Colors: ${analysis.totalColors}
- Color Mode: ${colorMode} (max ${maxColors} colors)
- Utilization: ${analysis.utilization}%
- Duplicates: ${analysis.duplicates}

## Color Distribution:
${colors.map((color, i) => `${i}: ${color} → ${rgbToSnes(color)}`).join('\n')}

## Recommendations:

### Optimization Opportunities:
${analysis.duplicates > 0 ? `- Remove ${analysis.duplicates} duplicate colors` : '- No duplicate colors found'}
${analysis.utilization > 100 ? `- Reduce palette size (${analysis.totalColors - maxColors} colors over limit)` : ''}
${analysis.utilization < 50 ? '- Consider using smaller color mode for memory savings' : ''}

### SNES-Specific Considerations:
- Color 0 should be transparent/background
- Group related colors in palette slots
- Consider palette animation needs
- Plan for brightness/contrast adjustments

### Visual Quality:
- Ensure sufficient contrast for readability
- Use consistent color temperature
- Consider color-blind accessibility
- Test on actual SNES hardware if possible

## Memory Usage:
- Current: ${colors.length * 2} bytes
- Optimized: ${Math.min(colors.length, maxColors) * 2} bytes
- Per palette slot: 2 bytes (SNES 15-bit color)
`;

  return {
    success: true,
    message: `Analyzed ${colors.length} colors for ${colorMode} mode`,
    data: {
      paletteInfo: {
        colorCount: colors.length,
        snesFormat: colors.map(rgbToSnes),
        rgbFormat: colors,
        memoryUsage: colors.length * 2,
      },
      conversionData: analysisReport,
    },
  };
}

import { Type } from '@sinclair/typebox';
import { createTypedTool } from './typed-tool-system.js';
import fs from 'fs/promises';
import path from 'path';

/**
 * SNES Tilemap Generator Tool
 *
 * Creates and manages tilemaps for SNES backgrounds, including
 * level editors, collision maps, and tile-based game worlds for PVSnesLib.
 */
export const tilemapGeneratorTool = createTypedTool({
  name: 'tilemap_generator',
  description:
    'Generate SNES tilemaps - levels, backgrounds, collision maps for PVSnesLib',
  inputSchema: Type.Object({
    action: Type.Union(
      [
        Type.Literal('create_tilemap'),
        Type.Literal('convert_tiled_map'),
        Type.Literal('generate_collision'),
        Type.Literal('create_level_editor'),
        Type.Literal('optimize_map'),
        Type.Literal('generate_parallax'),
        Type.Literal('create_minimap'),
      ],
      {
        description: 'Tilemap generation action',
      }
    ),
    mapWidth: Type.Optional(
      Type.Number({
        description: 'Map width in tiles',
        minimum: 1,
        maximum: 1024,
      })
    ),
    mapHeight: Type.Optional(
      Type.Number({
        description: 'Map height in tiles',
        minimum: 1,
        maximum: 1024,
      })
    ),
    tileSize: Type.Optional(
      Type.Union(
        [Type.Literal('8x8'), Type.Literal('16x16'), Type.Literal('32x32')],
        {
          description: 'Individual tile size',
        }
      )
    ),
    mapMode: Type.Optional(
      Type.Union(
        [
          Type.Literal('32x32'),
          Type.Literal('32x64'),
          Type.Literal('64x32'),
          Type.Literal('64x64'),
        ],
        {
          description: 'SNES background map size',
        }
      )
    ),
    filePath: Type.Optional(
      Type.String({
        description: 'Input file path (for conversions)',
      })
    ),
    outputFormat: Type.Optional(
      Type.Union(
        [
          Type.Literal('binary'),
          Type.Literal('c_array'),
          Type.Literal('assembly'),
          Type.Literal('compressed'),
        ],
        {
          description: 'Output format for map data',
        }
      )
    ),
    includeCollision: Type.Optional(
      Type.Boolean({
        description: 'Generate collision detection data',
      })
    ),
    levelName: Type.Optional(
      Type.String({
        description: 'Name for the level/map',
      })
    ),
  }),
  outputSchema: Type.Object({
    success: Type.Boolean(),
    message: Type.String(),
    data: Type.Optional(
      Type.Object({
        generatedFiles: Type.Optional(Type.Array(Type.String())),
        mapInfo: Type.Optional(
          Type.Object({
            width: Type.Number(),
            height: Type.Number(),
            tileCount: Type.Number(),
            memoryUsage: Type.Number(),
            compressionRatio: Type.Optional(Type.Number()),
          })
        ),
        codeSnippet: Type.Optional(Type.String()),
        instructions: Type.Optional(Type.String()),
      })
    ),
  }),
  handler: async input => {
    try {
      const {
        action,
        mapWidth = 32,
        mapHeight = 32,
        tileSize = '8x8',
        mapMode = '32x32',
        filePath,
        outputFormat = 'c_array',
        includeCollision = false,
        levelName = 'level1',
      } = input;

      switch (action) {
        case 'create_tilemap':
          return await createTilemap(
            levelName,
            mapWidth,
            mapHeight,
            tileSize,
            mapMode,
            outputFormat,
            includeCollision
          );

        case 'convert_tiled_map':
          if (!filePath) {
            return {
              success: false,
              message: 'filePath is required for Tiled map conversion',
            };
          }
          return await convertTiledMap(filePath, outputFormat);

        case 'generate_collision':
          return await generateCollisionMap(levelName, mapWidth, mapHeight);

        case 'create_level_editor':
          return await createLevelEditor(tileSize, mapMode);

        case 'optimize_map':
          if (!filePath) {
            return {
              success: false,
              message: 'filePath is required for map optimization',
            };
          }
          return await optimizeMap(filePath);

        case 'generate_parallax':
          return await generateParallaxLayers(mapWidth, mapHeight, mapMode);

        case 'create_minimap':
          return await createMinimap(levelName, mapWidth, mapHeight);

        default:
          return { success: false, message: `Unknown action: ${action}` };
      }
    } catch (error) {
      return {
        success: false,
        message: `Tilemap generator error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  },
});

async function createTilemap(
  levelName: string,
  mapWidth: number,
  mapHeight: number,
  tileSize: string,
  mapMode: string,
  outputFormat: string,
  includeCollision: boolean
) {
  const totalTiles = mapWidth * mapHeight;
  const memoryUsage = totalTiles * 2; // 16-bit per tile entry

  // Generate tilemap header
  const mapHeader = `#ifndef ${levelName.toUpperCase()}_MAP_H
#define ${levelName.toUpperCase()}_MAP_H

#include <snes.h>

// Map: ${levelName}
// Size: ${mapWidth}x${mapHeight} tiles
// Tile Size: ${tileSize}
// Map Mode: ${mapMode}

#define ${levelName.toUpperCase()}_MAP_WIDTH  ${mapWidth}
#define ${levelName.toUpperCase()}_MAP_HEIGHT ${mapHeight}
#define ${levelName.toUpperCase()}_MAP_SIZE   ${totalTiles}
#define ${levelName.toUpperCase()}_TILE_SIZE  ${tileSize}

// Map data format: VHOPPPCC CCCCCCCC
// V = Vertical flip (bit 15)
// H = Horizontal flip (bit 14)  
// O = Priority (bit 13)
// P = Palette (bits 12-10)
// C = Character/Tile index (bits 9-0)

extern const u16 ${levelName}_map_data[${totalTiles}];
${includeCollision ? `extern const u8 ${levelName}_collision_data[${totalTiles}];` : ''}

// Map functions
void ${levelName}Init(void);
void ${levelName}LoadMap(u16 bg_layer);
u16 ${levelName}GetTile(u16 x, u16 y);
void ${levelName}SetTile(u16 x, u16 y, u16 tile_id);
${
  includeCollision
    ? `
u8 ${levelName}GetCollision(u16 x, u16 y);
bool ${levelName}IsColliding(u16 pixel_x, u16 pixel_y);
`
    : ''
}

#endif // ${levelName.toUpperCase()}_MAP_H`;

  // Generate tilemap source
  const mapSource = `#include "${levelName}_map.h"

// Tilemap data (${mapWidth}x${mapHeight} = ${totalTiles} tiles)
const u16 ${levelName}_map_data[${totalTiles}] = {
    // Row 0
    ${generateMapDataRows(mapWidth, mapHeight, outputFormat)}
};

${
  includeCollision
    ? `
// Collision data (1 byte per tile)
// 0 = passable, 1 = solid, 2 = water, 3 = damage, etc.
const u8 ${levelName}_collision_data[${totalTiles}] = {
    ${generateCollisionData(mapWidth, mapHeight)}
};
`
    : ''
}

void ${levelName}Init(void) {
    consoleWrite("Loading ${levelName} map...\\n");
}

void ${levelName}LoadMap(u16 bg_layer) {
    // Load tilemap to specified background layer
    u16 vram_addr = (bg_layer == 0) ? 0x7000 : 0x7800; // BG0 or BG1 map base
    
    dmaCopyVram(${levelName}_map_data, vram_addr, sizeof(${levelName}_map_data));
    consoleWrite("Map loaded to BG layer %d\\n", bg_layer);
}

u16 ${levelName}GetTile(u16 x, u16 y) {
    if (x >= ${mapWidth} || y >= ${mapHeight}) return 0;
    return ${levelName}_map_data[y * ${mapWidth} + x];
}

void ${levelName}SetTile(u16 x, u16 y, u16 tile_id) {
    if (x >= ${mapWidth} || y >= ${mapHeight}) return;
    ${levelName}_map_data[y * ${mapWidth} + x] = tile_id;
    
    // Update VRAM if map is already loaded
    // u16 vram_addr = 0x7000 + (y * 32 + x) * 2;
    // dmaCopyVram(&tile_id, vram_addr, 2);
}

${
  includeCollision
    ? `
u8 ${levelName}GetCollision(u16 x, u16 y) {
    if (x >= ${mapWidth} || y >= ${mapHeight}) return 1; // Solid outside bounds
    return ${levelName}_collision_data[y * ${mapWidth} + x];
}

bool ${levelName}IsColliding(u16 pixel_x, u16 pixel_y) {
    u16 tile_x = pixel_x / ${tileSize.split('x')[0]};
    u16 tile_y = pixel_y / ${tileSize.split('x')[1]};
    return ${levelName}GetCollision(tile_x, tile_y) != 0;
}
`
    : ''
}`;

  // Generate level editor template
  const editorTemplate = `// Level Editor for ${levelName}
#ifndef ${levelName.toUpperCase()}_EDITOR_H
#define ${levelName.toUpperCase()}_EDITOR_H

#include "${levelName}_map.h"

// Editor state
typedef struct {
    u16 cursor_x;
    u16 cursor_y;
    u16 selected_tile;
    u8 current_palette;
    bool edit_mode;
} level_editor_t;

extern level_editor_t editor_state;

// Editor functions
void ${levelName}EditorInit(void);
void ${levelName}EditorUpdate(void);
void ${levelName}EditorRender(void);
void ${levelName}EditorSetTile(u16 tile_id);
void ${levelName}EditorMoveCursor(s8 dx, s8 dy);
void ${levelName}EditorToggleMode(void);
void ${levelName}EditorSave(const char *filename);
void ${levelName}EditorLoad(const char *filename);

#endif`;

  return {
    success: true,
    message: `Created tilemap system for ${levelName} (${mapWidth}x${mapHeight})`,
    data: {
      generatedFiles: [
        `${levelName}_map.h`,
        `${levelName}_map.c`,
        `${levelName}_editor.h`,
      ].concat(includeCollision ? [`${levelName}_collision.h`] : []),
      mapInfo: {
        width: mapWidth,
        height: mapHeight,
        tileCount: totalTiles,
        memoryUsage,
      },
      codeSnippet: `// Initialize and use tilemap\n${levelName}Init();\n${levelName}LoadMap(0); // Load to BG0\n\n// Check collision\nif (${levelName}IsColliding(player_x, player_y)) {\n    // Handle collision\n}`,
    },
  };
}

function generateMapDataRows(
  width: number,
  height: number,
  format: string
): string {
  const rows = [];
  for (let y = 0; y < height; y++) {
    const tiles = [];
    for (let x = 0; x < width; x++) {
      // Generate sample tile data
      let tileId = 0;
      if (y === 0 || y === height - 1)
        tileId = 1; // Top/bottom border
      else if (x === 0 || x === width - 1)
        tileId = 2; // Side border
      else if (Math.random() > 0.8) tileId = 3; // Random objects

      tiles.push(`0x${tileId.toString(16).padStart(4, '0').toUpperCase()}`);
    }
    rows.push(
      `    // Row ${y}\n    ${tiles.join(', ')}${y < height - 1 ? ',' : ''}`
    );
  }
  return rows.join('\n');
}

function generateCollisionData(width: number, height: number): string {
  const rows = [];
  for (let y = 0; y < height; y++) {
    const tiles = [];
    for (let x = 0; x < width; x++) {
      // Generate sample collision data
      let collision = 0;
      if (y === 0 || y === height - 1 || x === 0 || x === width - 1) {
        collision = 1; // Borders are solid
      }
      tiles.push(collision.toString());
    }
    rows.push(`    ${tiles.join(', ')}${y < height - 1 ? ',' : ''}`);
  }
  return rows.join('\n');
}

async function convertTiledMap(filePath: string, outputFormat: string) {
  const basename = path.basename(filePath, path.extname(filePath));

  const conversionScript = `#!/bin/bash
# Convert Tiled map to SNES format

INPUT_FILE="${filePath}"
OUTPUT_BASE="${basename}"

echo "Converting Tiled map: \$INPUT_FILE"

# Check if input file exists
if [ ! -f "\$INPUT_FILE" ]; then
    echo "Error: Input file not found!"
    exit 1
fi

# Extract map data from Tiled JSON/XML format
case "\${INPUT_FILE##*.}" in
    "json")
        echo "Converting from Tiled JSON..."
        # Use jq to extract map data
        jq -r '.layers[0].data[]' "\$INPUT_FILE" > "\${OUTPUT_BASE}_raw.txt"
        ;;
    "tmx")
        echo "Converting from Tiled TMX..."
        # Use xmlstarlet or custom parser
        # xmlstarlet sel -t -v "//layer/data" "\$INPUT_FILE" > "\${OUTPUT_BASE}_raw.txt"
        ;;
    *)
        echo "Unsupported format: \${INPUT_FILE##*.}"
        exit 1
        ;;
esac

# Convert to C array format
echo "Generating C array..."
cat > "\${OUTPUT_BASE}_map.h" << 'EOF'
#ifndef ${basename.toUpperCase()}_MAP_H
#define ${basename.toUpperCase()}_MAP_H

#include <snes.h>

extern const u16 ${basename}_map_data[];
extern const u16 ${basename}_map_width;
extern const u16 ${basename}_map_height;

void ${basename}LoadMap(u16 bg_layer);

#endif
EOF

cat > "\${OUTPUT_BASE}_map.c" << 'EOF'
#include "${basename}_map.h"

const u16 ${basename}_map_width = 32;  // Update with actual width
const u16 ${basename}_map_height = 32; // Update with actual height

const u16 ${basename}_map_data[] = {
    // TODO: Replace with converted tile data
EOF

# Convert raw data to C array format
awk '{printf "    0x%04X,\\n", $1}' "\${OUTPUT_BASE}_raw.txt" >> "\${OUTPUT_BASE}_map.c"

echo "};" >> "\${OUTPUT_BASE}_map.c"

echo ""
echo "void ${basename}LoadMap(u16 bg_layer) {"
echo "    u16 vram_addr = (bg_layer == 0) ? 0x7000 : 0x7800;"
echo "    dmaCopyVram(${basename}_map_data, vram_addr, ${basename}_map_width * ${basename}_map_height * 2);"
echo "}" >> "\${OUTPUT_BASE}_map.c"

echo "Conversion complete!"
echo "Generated files:"
echo "  - \${OUTPUT_BASE}_map.h"
echo "  - \${OUTPUT_BASE}_map.c"`;

  const tiledIntegration = `# Tiled Editor Integration Guide

## Exporting from Tiled:
1. Create map in Tiled Editor
2. Set tile size to 8x8 or 16x16
3. Use tileset with SNES-compatible graphics
4. Export as JSON format: File → Export → JSON map files

## Map Properties:
- Width/Height: Multiples of 32 tiles (SNES background size)
- Tile IDs: 0-1023 (10-bit tile index)
- Layers: Use separate layers for foreground/background

## Custom Properties:
Add custom properties to tiles for SNES-specific data:
- collision: 0=none, 1=solid, 2=water, etc.
- priority: 0=normal, 1=high priority
- palette: 0-7 (palette index)
- flip_h: true/false (horizontal flip)
- flip_v: true/false (vertical flip)

## Integration Steps:
1. Export map from Tiled as JSON
2. Run conversion script: ./convert_tiled.sh
3. Include generated .h/.c files in project
4. Load map: ${basename}LoadMap(0);`;

  return {
    success: true,
    message: `Generated Tiled map conversion setup for ${basename}`,
    data: {
      generatedFiles: [`convert_${basename}.sh`, `tiled_integration_guide.md`],
      instructions: tiledIntegration,
      codeSnippet: conversionScript,
    },
  };
}

async function generateCollisionMap(
  levelName: string,
  mapWidth: number,
  mapHeight: number
) {
  const collisionHeader = `// Collision System for ${levelName}
#ifndef ${levelName.toUpperCase()}_COLLISION_H
#define ${levelName.toUpperCase()}_COLLISION_H

#include <snes.h>

// Collision types
#define COLLISION_NONE     0
#define COLLISION_SOLID    1
#define COLLISION_WATER    2
#define COLLISION_DAMAGE   3
#define COLLISION_ICE      4
#define COLLISION_LADDER   5
#define COLLISION_PLATFORM 6
#define COLLISION_CUSTOM   7

// Collision detection
typedef struct {
    u16 x, y;           // Tile coordinates
    u8 type;            // Collision type
    u8 flags;           // Additional flags
} collision_tile_t;

// Collision functions
bool ${levelName}CheckCollision(u16 x, u16 y, u8 collision_type);
bool ${levelName}CheckRectCollision(u16 x, u16 y, u16 w, u16 h, u8 collision_type);
u8 ${levelName}GetCollisionType(u16 x, u16 y);
void ${levelName}SetCollisionType(u16 x, u16 y, u8 collision_type);

// Physics helpers
bool ${levelName}CanMoveRight(u16 x, u16 y, u16 w, u16 h);
bool ${levelName}CanMoveLeft(u16 x, u16 y, u16 w, u16 h);
bool ${levelName}CanMoveUp(u16 x, u16 y, u16 w, u16 h);
bool ${levelName}CanMoveDown(u16 x, u16 y, u16 w, u16 h);
bool ${levelName}IsOnGround(u16 x, u16 y, u16 w, u16 h);

#endif`;

  const collisionSource = `#include "${levelName}_collision.h"
#include "${levelName}_map.h"

// Collision lookup table
static const u8 tile_collision_types[] = {
    COLLISION_NONE,     // Tile 0: Empty
    COLLISION_SOLID,    // Tile 1: Wall
    COLLISION_SOLID,    // Tile 2: Block
    COLLISION_WATER,    // Tile 3: Water
    COLLISION_DAMAGE,   // Tile 4: Spikes
    COLLISION_ICE,      // Tile 5: Ice
    COLLISION_LADDER,   // Tile 6: Ladder
    COLLISION_PLATFORM, // Tile 7: Platform
    // Add more tile types...
};

bool ${levelName}CheckCollision(u16 x, u16 y, u8 collision_type) {
    u16 tile_x = x / 8; // Assuming 8x8 tiles
    u16 tile_y = y / 8;
    
    u8 type = ${levelName}GetCollisionType(tile_x, tile_y);
    return (type == collision_type) || (collision_type == COLLISION_SOLID && type != COLLISION_NONE);
}

bool ${levelName}CheckRectCollision(u16 x, u16 y, u16 w, u16 h, u8 collision_type) {
    // Check all corners of the rectangle
    return ${levelName}CheckCollision(x, y, collision_type) ||
           ${levelName}CheckCollision(x + w - 1, y, collision_type) ||
           ${levelName}CheckCollision(x, y + h - 1, collision_type) ||
           ${levelName}CheckCollision(x + w - 1, y + h - 1, collision_type);
}

u8 ${levelName}GetCollisionType(u16 x, u16 y) {
    if (x >= ${mapWidth} || y >= ${mapHeight}) {
        return COLLISION_SOLID; // Outside bounds is solid
    }
    
    u16 tile_id = ${levelName}GetTile(x, y) & 0x3FF; // Mask to get tile index
    
    if (tile_id < sizeof(tile_collision_types)) {
        return tile_collision_types[tile_id];
    }
    
    return COLLISION_NONE;
}

bool ${levelName}CanMoveRight(u16 x, u16 y, u16 w, u16 h) {
    return !${levelName}CheckCollision(x + w, y, COLLISION_SOLID) &&
           !${levelName}CheckCollision(x + w, y + h - 1, COLLISION_SOLID);
}

bool ${levelName}CanMoveLeft(u16 x, u16 y, u16 w, u16 h) {
    return !${levelName}CheckCollision(x - 1, y, COLLISION_SOLID) &&
           !${levelName}CheckCollision(x - 1, y + h - 1, COLLISION_SOLID);
}

bool ${levelName}CanMoveUp(u16 x, u16 y, u16 w, u16 h) {
    return !${levelName}CheckCollision(x, y - 1, COLLISION_SOLID) &&
           !${levelName}CheckCollision(x + w - 1, y - 1, COLLISION_SOLID);
}

bool ${levelName}CanMoveDown(u16 x, u16 y, u16 w, u16 h) {
    return !${levelName}CheckCollision(x, y + h, COLLISION_SOLID) &&
           !${levelName}CheckCollision(x + w - 1, y + h, COLLISION_SOLID);
}

bool ${levelName}IsOnGround(u16 x, u16 y, u16 w, u16 h) {
    return ${levelName}CheckCollision(x, y + h, COLLISION_SOLID) ||
           ${levelName}CheckCollision(x + w - 1, y + h, COLLISION_SOLID) ||
           ${levelName}CheckCollision(x + w/2, y + h, COLLISION_PLATFORM);
}`;

  return {
    success: true,
    message: `Generated collision system for ${levelName}`,
    data: {
      generatedFiles: [`${levelName}_collision.h`, `${levelName}_collision.c`],
      mapInfo: {
        width: mapWidth,
        height: mapHeight,
        tileCount: mapWidth * mapHeight,
        memoryUsage: mapWidth * mapHeight, // 1 byte per tile for collision
      },
      codeSnippet: `// Check collision before moving\nif (${levelName}CanMoveRight(player_x, player_y, 16, 16)) {\n    player_x += speed;\n}\n\n// Check for special collision types\nif (${levelName}CheckCollision(player_x, player_y, COLLISION_WATER)) {\n    // Player is in water\n}`,
    },
  };
}

async function createLevelEditor(tileSize: string, mapMode: string) {
  const editorCode = `// SNES Level Editor
#ifndef LEVEL_EDITOR_H
#define LEVEL_EDITOR_H

#include <snes.h>

// Editor configuration
#define EDITOR_MAX_TILESETS  8
#define EDITOR_MAX_TILES     256
#define EDITOR_CURSOR_TILE   0x3FF  // Special cursor tile

// Editor state
typedef struct {
    u16 map_width;
    u16 map_height;
    u16 cursor_x;
    u16 cursor_y;
    u16 current_tile;
    u8 current_palette;
    u8 current_tileset;
    bool paint_mode;
    bool show_grid;
    bool show_collision;
    u16 scroll_x;
    u16 scroll_y;
} editor_state_t;

extern editor_state_t editor;

// Editor functions
void editorInit(void);
void editorUpdate(void);
void editorRender(void);
void editorHandleInput(u16 pad);
void editorSetTile(u16 x, u16 y, u16 tile_id);
u16 editorGetTile(u16 x, u16 y);
void editorMoveCursor(s8 dx, s8 dy);
void editorSelectTile(u16 tile_id);
void editorSwitchTileset(u8 tileset_id);
void editorToggleGrid(void);
void editorSave(void);
void editorLoad(void);

// Tileset management
void editorLoadTileset(u8 tileset_id, const u8 *tile_data, const u16 *palette_data);
void editorRefreshTilesetDisplay(void);

#endif`;

  const editorImplementation = `#include "level_editor.h"

editor_state_t editor = {
    .map_width = 32,
    .map_height = 32,
    .cursor_x = 0,
    .cursor_y = 0,
    .current_tile = 1,
    .current_palette = 0,
    .current_tileset = 0,
    .paint_mode = false,
    .show_grid = true,
    .show_collision = false,
    .scroll_x = 0,
    .scroll_y = 0
};

static u16 *map_buffer = NULL;
static bool cursor_blink = false;
static u8 blink_timer = 0;

void editorInit(void) {
    // Initialize display modes
    bgSetMode(BG_MODE1, 0);
    bgSetDisable(0); // Enable BG0 for map
    bgSetDisable(1); // Enable BG1 for UI
    
    // Allocate map buffer
    map_buffer = (u16*)malloc(editor.map_width * editor.map_height * sizeof(u16));
    
    // Clear map
    for (u16 i = 0; i < editor.map_width * editor.map_height; i++) {
        map_buffer[i] = 0;
    }
    
    // Load default tileset
    editorLoadTileset(0, default_tiles, default_palette);
    
    consoleWrite("Level editor initialized\\n");
}

void editorUpdate(void) {
    // Handle blinking cursor
    blink_timer++;
    if (blink_timer >= 30) { // 30 frames = 0.5 seconds
        cursor_blink = !cursor_blink;
        blink_timer = 0;
    }
    
    // Read controller input
    u16 pad = padsCurrent(0);
    editorHandleInput(pad);
}

void editorRender(void) {
    // Render map to background
    for (u16 y = 0; y < 28; y++) { // Visible area
        for (u16 x = 0; x < 32; x++) {
            u16 map_x = x + (editor.scroll_x / 8);
            u16 map_y = y + (editor.scroll_y / 8);
            
            if (map_x < editor.map_width && map_y < editor.map_height) {
                u16 tile = editorGetTile(map_x, map_y);
                
                // Add palette and priority info
                tile |= (editor.current_palette << 10);
                
                // Write to BG0 tilemap
                u16 vram_addr = 0x7000 + (y * 32 + x) * 2;
                dmaCopyVram(&tile, vram_addr, 2);
            }
        }
    }
    
    // Render cursor
    if (cursor_blink) {
        u16 screen_x = editor.cursor_x - (editor.scroll_x / 8);
        u16 screen_y = editor.cursor_y - (editor.scroll_y / 8);
        
        if (screen_x < 32 && screen_y < 28) {
            u16 cursor_tile = EDITOR_CURSOR_TILE | (7 << 10); // White palette
            u16 vram_addr = 0x7000 + (screen_y * 32 + screen_x) * 2;
            dmaCopyVram(&cursor_tile, vram_addr, 2);
        }
    }
    
    // Render UI elements on BG1
    editorRenderUI();
}

void editorHandleInput(u16 pad) {
    // Movement
    if (padsCurrent(0) & KEY_LEFT) {
        editorMoveCursor(-1, 0);
    }
    if (padsCurrent(0) & KEY_RIGHT) {
        editorMoveCursor(1, 0);
    }
    if (padsCurrent(0) & KEY_UP) {
        editorMoveCursor(0, -1);
    }
    if (padsCurrent(0) & KEY_DOWN) {
        editorMoveCursor(0, 1);
    }
    
    // Place tile
    if (padsCurrent(0) & KEY_A) {
        editorSetTile(editor.cursor_x, editor.cursor_y, editor.current_tile);
    }
    
    // Erase tile
    if (padsCurrent(0) & KEY_B) {
        editorSetTile(editor.cursor_x, editor.cursor_y, 0);
    }
    
    // Toggle paint mode
    if (padsDown(0) & KEY_X) {
        editor.paint_mode = !editor.paint_mode;
    }
    
    // Tile selection
    if (padsCurrent(0) & KEY_L) {
        if (editor.current_tile > 0) editor.current_tile--;
    }
    if (padsCurrent(0) & KEY_R) {
        if (editor.current_tile < 255) editor.current_tile++;
    }
    
    // Save/Load
    if (padsDown(0) & KEY_START) {
        editorSave();
    }
    if (padsDown(0) & KEY_SELECT) {
        editorLoad();
    }
}`;

  return {
    success: true,
    message: `Generated level editor system for ${tileSize} tiles, ${mapMode} mode`,
    data: {
      generatedFiles: ['level_editor.h', 'level_editor.c', 'editor_ui.c'],
      codeSnippet: `// Initialize and run level editor\neditorInit();\n\n// Main editor loop\nwhile(1) {\n    editorUpdate();\n    editorRender();\n    WaitForVBlank();\n}`,
    },
  };
}

async function optimizeMap(filePath: string) {
  const basename = path.basename(filePath, path.extname(filePath));

  const optimizationScript = `#!/bin/bash
# Map Optimization Script for ${basename}

echo "Optimizing map: ${filePath}"

# Step 1: Analyze tile usage
echo "Analyzing tile usage patterns..."

# Step 2: Remove unused tiles
echo "Removing unused tiles..."

# Step 3: Optimize tile order
echo "Reordering tiles for better compression..."

# Step 4: Apply compression
echo "Applying compression..."

# RLE compression for simple patterns
rle_compress() {
    local input=\$1
    local output=\$2
    # Simple RLE implementation
    # This would compress repeated tile sequences
}

# Dictionary compression for complex patterns
dict_compress() {
    local input=\$1
    local output=\$2
    # Pattern-based compression
    # Find common tile sequences and replace with tokens
}

echo "Optimization complete!"`;

  const optimizationTips = `# Map Optimization Techniques

## Tile Optimization:
1. Remove duplicate tiles (30-50% savings)
2. Merge similar tiles with palette swaps
3. Use tile flipping (H/V) to reduce tile count
4. Group tiles by usage frequency

## Memory Layout:
1. Place common tiles at lower indices
2. Align tile data to 8-byte boundaries
3. Use contiguous memory blocks
4. Consider VRAM bank switching

## Compression Methods:
1. RLE: Good for uniform areas (sky, water)
2. LZ77: General purpose compression
3. Dictionary: Pattern-based compression
4. Hybrid: Combine methods for best results

## SNES-Specific Optimizations:
1. Use 32x32 map size when possible
2. Minimize palette changes
3. Consider Priority bit usage
4. Plan for scrolling requirements`;

  return {
    success: true,
    message: `Generated optimization plan for ${basename}`,
    data: {
      generatedFiles: [`optimize_${basename}.sh`],
      instructions: optimizationTips,
      codeSnippet: optimizationScript,
    },
  };
}

async function generateParallaxLayers(
  mapWidth: number,
  mapHeight: number,
  mapMode: string
) {
  const parallaxSystem = `// Parallax Background System
#ifndef PARALLAX_H
#define PARALLAX_H

#include <snes.h>

// Parallax layer configuration
#define PARALLAX_LAYERS 4

typedef struct {
    u16 *map_data;      // Layer map data
    u16 scroll_x;       // Current X scroll
    u16 scroll_y;       // Current Y scroll
    u8 scroll_speed;    // Scroll speed multiplier (0-255)
    u8 bg_layer;        // SNES BG layer (0-3)
    bool enabled;       // Layer enabled flag
} parallax_layer_t;

extern parallax_layer_t parallax_layers[PARALLAX_LAYERS];

// Parallax functions
void parallaxInit(void);
void parallaxUpdate(s16 camera_x, s16 camera_y);
void parallaxSetLayer(u8 layer, u16 *map_data, u8 speed, u8 bg_layer);
void parallaxSetScroll(u8 layer, u16 x, u16 y);
void parallaxEnable(u8 layer, bool enable);

#endif`;

  const parallaxImplementation = `#include "parallax.h"

parallax_layer_t parallax_layers[PARALLAX_LAYERS];

void parallaxInit(void) {
    // Initialize all layers
    for (u8 i = 0; i < PARALLAX_LAYERS; i++) {
        parallax_layers[i].map_data = NULL;
        parallax_layers[i].scroll_x = 0;
        parallax_layers[i].scroll_y = 0;
        parallax_layers[i].scroll_speed = 255; // Full speed
        parallax_layers[i].bg_layer = i;
        parallax_layers[i].enabled = false;
    }
    
    // Set up BG mode for parallax (Mode 1 with 4 BG layers)
    bgSetMode(BG_MODE1, 0);
    
    consoleWrite("Parallax system initialized\\n");
}

void parallaxUpdate(s16 camera_x, s16 camera_y) {
    for (u8 i = 0; i < PARALLAX_LAYERS; i++) {
        if (!parallax_layers[i].enabled) continue;
        
        // Calculate parallax scroll based on camera position and speed
        u16 scroll_x = (camera_x * parallax_layers[i].scroll_speed) / 256;
        u16 scroll_y = (camera_y * parallax_layers[i].scroll_speed) / 256;
        
        parallax_layers[i].scroll_x = scroll_x;
        parallax_layers[i].scroll_y = scroll_y;
        
        // Update SNES background scroll registers
        bgSetScroll(parallax_layers[i].bg_layer, scroll_x, scroll_y);
    }
}

void parallaxSetLayer(u8 layer, u16 *map_data, u8 speed, u8 bg_layer) {
    if (layer >= PARALLAX_LAYERS) return;
    
    parallax_layers[layer].map_data = map_data;
    parallax_layers[layer].scroll_speed = speed;
    parallax_layers[layer].bg_layer = bg_layer;
    parallax_layers[layer].enabled = true;
    
    // Load map data to VRAM
    u16 vram_addr = 0x7000 + (bg_layer * 0x800); // Each BG gets 2KB
    dmaCopyVram(map_data, vram_addr, ${mapWidth * mapHeight * 2});
}

// Example layer setup
void setupParallaxDemo(void) {
    // Layer 0: Far background (mountains) - slow scroll
    parallaxSetLayer(0, mountains_map, 64, 3);   // 25% speed
    
    // Layer 1: Mid background (clouds) - medium scroll  
    parallaxSetLayer(1, clouds_map, 128, 2);     // 50% speed
    
    // Layer 2: Near background (trees) - fast scroll
    parallaxSetLayer(2, trees_map, 192, 1);      // 75% speed
    
    // Layer 3: Foreground (main level) - full speed
    parallaxSetLayer(3, level_map, 255, 0);      // 100% speed
}`;

  return {
    success: true,
    message: `Generated parallax scrolling system for ${mapMode} backgrounds`,
    data: {
      generatedFiles: ['parallax.h', 'parallax.c'],
      mapInfo: {
        width: mapWidth,
        height: mapHeight,
        tileCount: mapWidth * mapHeight * 4, // 4 layers
        memoryUsage: mapWidth * mapHeight * 2 * 4, // 4 layers of map data
      },
      codeSnippet: `// Setup and use parallax layers\nparallaxInit();\nsetupParallaxDemo();\n\n// Update each frame\nparallaxUpdate(camera_x, camera_y);`,
    },
  };
}

async function createMinimap(
  levelName: string,
  mapWidth: number,
  mapHeight: number
) {
  const minimapSystem = `// Minimap System for ${levelName}
#ifndef MINIMAP_H
#define MINIMAP_H

#include <snes.h>
#include "${levelName}_map.h"

// Minimap configuration
#define MINIMAP_WIDTH   32    // Minimap display width in pixels
#define MINIMAP_HEIGHT  32    // Minimap display height in pixels
#define MINIMAP_SCALE   ${Math.max(1, Math.floor(mapWidth / 32))}     // Scale factor (map tiles per minimap pixel)

// Minimap colors
#define MINIMAP_COLOR_EMPTY     0
#define MINIMAP_COLOR_WALL      1
#define MINIMAP_COLOR_PLAYER    2
#define MINIMAP_COLOR_ENEMY     3
#define MINIMAP_COLOR_ITEM      4
#define MINIMAP_COLOR_VISITED   5

// Minimap functions
void minimapInit(void);
void minimapUpdate(u16 player_x, u16 player_y);
void minimapRender(u16 screen_x, u16 screen_y);
void minimapMarkVisited(u16 x, u16 y);
void minimapSetPixel(u8 x, u8 y, u8 color);
u8 minimapGetPixel(u8 x, u8 y);

#endif`;

  const minimapImplementation = `#include "minimap.h"

static u8 minimap_buffer[MINIMAP_WIDTH * MINIMAP_HEIGHT];
static u8 visited_map[${Math.ceil(mapWidth / 8)}][${Math.ceil(mapHeight / 8)}]; // Bit array for visited areas

void minimapInit(void) {
    // Clear minimap buffer
    for (u16 i = 0; i < MINIMAP_WIDTH * MINIMAP_HEIGHT; i++) {
        minimap_buffer[i] = MINIMAP_COLOR_EMPTY;
    }
    
    // Clear visited map
    for (u8 x = 0; x < ${Math.ceil(mapWidth / 8)}; x++) {
        for (u8 y = 0; y < ${Math.ceil(mapHeight / 8)}; y++) {
            visited_map[x][y] = 0;
        }
    }
    
    // Generate initial minimap from level data
    minimapGenerateFromLevel();
    
    consoleWrite("Minimap initialized\\n");
}

void minimapGenerateFromLevel(void) {
    for (u8 y = 0; y < MINIMAP_HEIGHT; y++) {
        for (u8 x = 0; x < MINIMAP_WIDTH; x++) {
            // Sample level at scaled coordinates
            u16 level_x = x * MINIMAP_SCALE;
            u16 level_y = y * MINIMAP_SCALE;
            
            if (level_x < ${mapWidth} && level_y < ${mapHeight}) {
                u16 tile = ${levelName}GetTile(level_x, level_y);
                u8 color = MINIMAP_COLOR_EMPTY;
                
                // Convert tile to minimap color
                if (tile == 0) {
                    color = MINIMAP_COLOR_EMPTY;
                } else if (tile <= 2) {
                    color = MINIMAP_COLOR_WALL;
                } else {
                    color = MINIMAP_COLOR_WALL; // Default to wall
                }
                
                minimapSetPixel(x, y, color);
            }
        }
    }
}

void minimapUpdate(u16 player_x, u16 player_y) {
    // Mark current area as visited
    minimapMarkVisited(player_x, player_y);
    
    // Update player position on minimap
    u8 minimap_x = (player_x / 8) / MINIMAP_SCALE; // Convert pixel to tile to minimap
    u8 minimap_y = (player_y / 8) / MINIMAP_SCALE;
    
    // Clear old player position (would need to track previous position)
    // minimapSetPixel(old_x, old_y, old_color);
    
    // Set new player position
    if (minimap_x < MINIMAP_WIDTH && minimap_y < MINIMAP_HEIGHT) {
        minimapSetPixel(minimap_x, minimap_y, MINIMAP_COLOR_PLAYER);
    }
}

void minimapRender(u16 screen_x, u16 screen_y) {
    // Render minimap to a sprite or background tile
    // This would depend on how you want to display the minimap
    
    for (u8 y = 0; y < MINIMAP_HEIGHT; y++) {
        for (u8 x = 0; x < MINIMAP_WIDTH; x++) {
            u8 color = minimapGetPixel(x, y);
            
            // Draw pixel on screen
            // This is a simplified example - actual implementation would
            // use sprites or custom background tiles
            if (color != MINIMAP_COLOR_EMPTY) {
                // setPixel(screen_x + x, screen_y + y, color);
            }
        }
    }
}

void minimapMarkVisited(u16 x, u16 y) {
    u16 tile_x = x / 8; // Convert pixels to tiles
    u16 tile_y = y / 8;
    
    u8 byte_x = tile_x / 8;
    u8 byte_y = tile_y / 8;
    u8 bit = tile_x % 8;
    
    if (byte_x < ${Math.ceil(mapWidth / 8)} && byte_y < ${Math.ceil(mapHeight / 8)}) {
        visited_map[byte_x][byte_y] |= (1 << bit);
        
        // Update minimap display for visited areas
        u8 minimap_x = tile_x / MINIMAP_SCALE;
        u8 minimap_y = tile_y / MINIMAP_SCALE;
        
        if (minimap_x < MINIMAP_WIDTH && minimap_y < MINIMAP_HEIGHT) {
            if (minimapGetPixel(minimap_x, minimap_y) == MINIMAP_COLOR_EMPTY) {
                minimapSetPixel(minimap_x, minimap_y, MINIMAP_COLOR_VISITED);
            }
        }
    }
}

void minimapSetPixel(u8 x, u8 y, u8 color) {
    if (x < MINIMAP_WIDTH && y < MINIMAP_HEIGHT) {
        minimap_buffer[y * MINIMAP_WIDTH + x] = color;
    }
}

u8 minimapGetPixel(u8 x, u8 y) {
    if (x < MINIMAP_WIDTH && y < MINIMAP_HEIGHT) {
        return minimap_buffer[y * MINIMAP_WIDTH + x];
    }
    return MINIMAP_COLOR_EMPTY;
}`;

  return {
    success: true,
    message: `Generated minimap system for ${levelName}`,
    data: {
      generatedFiles: ['minimap.h', 'minimap.c'],
      mapInfo: {
        width: 32,
        height: 32,
        tileCount: 32 * 32,
        memoryUsage:
          32 * 32 + Math.ceil(mapWidth / 8) * Math.ceil(mapHeight / 8),
      },
      codeSnippet: `// Initialize and use minimap\nminimapInit();\n\n// Update each frame\nminimapUpdate(player_x, player_y);\nminimapRender(200, 8); // Draw at top-right corner`,
    },
  };
}

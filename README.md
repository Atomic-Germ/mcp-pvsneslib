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
MCP_SERVER_NAME=my-server
MCP_SERVER_PORT=3000
MCP_SERVER_HOST=localhost
MCP_LOG_LEVEL=debug
```

## Creating Your Own Tools

### 1. Define a Tool

```typescript
import type { ToolHandler, ToolResult } from '../types/index.js';

export const myCustomTool: ToolHandler = {
  name: 'my_tool',
  description: 'Description of what this tool does',
  parameters: [
    {
      name: 'param1',
      type: 'string',
      description: 'Description of parameter',
      required: true,
    },
    {
      name: 'param2',
      type: 'number',
      description: 'Optional numeric parameter',
      required: false,
      default: 42,
    },
  ],
  async execute(params: { param1: string; param2?: number }): Promise<ToolResult> {
    try {
      // Your tool logic here
      const result = `Processing ${params.param1} with value ${params.param2 || 42}`;
      
      return {
        success: true,
        content: result,
        metadata: {
          timestamp: new Date().toISOString(),
          executionTime: Date.now(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
};
```

### 2. Register the Tool

```typescript
// In src/server/index.ts or your custom server setup
import { myCustomTool } from '../tools/my-custom-tool.js';

server.registerTool(myCustomTool);

// Or add to tools/index.ts for automatic registration
export const defaultTools: ToolHandler[] = [
  greetingTool,
  calculatorTool,
  fileReaderTool,
  myCustomTool, // Add your tool here
];
```

### 3. Test Your Tool

```typescript
// In test/tools/my-custom-tool.test.ts
import { describe, it, expect } from 'vitest';
import { myCustomTool } from '../../src/tools/my-custom-tool.js';

describe('myCustomTool', () => {
  it('should process input correctly', async () => {
    const result = await myCustomTool.execute({ 
      param1: 'test', 
      param2: 100 
    });
    
    expect(result.success).toBe(true);
    expect(result.content).toContain('Processing test with value 100');
    expect(result.metadata).toBeDefined();
  });

  it('should handle missing optional parameters', async () => {
    const result = await myCustomTool.execute({ param1: 'test' });
    
    expect(result.success).toBe(true);
    expect(result.content).toContain('with value 42');
  });

  it('should handle errors gracefully', async () => {
    const result = await myCustomTool.execute({ param1: '' });
    
    // Add your error handling tests
  });
});
```

## Tool Parameters

Tools support the following parameter types:

| Type | Description | Example |
|------|-------------|---------|
| `string` | Text values | `"Hello, World!"` |
| `number` | Numeric values | `42`, `3.14` |
| `boolean` | True/false values | `true`, `false` |
| `object` | Complex objects | `{ key: "value" }` |
| `array` | Lists of values | `[1, 2, 3]` |

### Parameter Validation

The template includes automatic parameter validation:

```typescript
// Automatic validation based on parameter definition
parameters: [
  {
    name: 'email',
    type: 'string',
    description: 'Valid email address',
    required: true,
  },
]

// The framework validates:
// - Required parameters are present
// - Parameter types match expected types
// - Throws meaningful error messages for violations
```

## Error Handling

The template includes comprehensive error handling with standard MCP error codes:

```typescript
// Standard MCP error codes
MCP_ERROR_CODES.PARSE_ERROR       // -32700
MCP_ERROR_CODES.INVALID_REQUEST   // -32600
MCP_ERROR_CODES.METHOD_NOT_FOUND  // -32601
MCP_ERROR_CODES.INVALID_PARAMS    // -32602
MCP_ERROR_CODES.INTERNAL_ERROR    // -32603

// Usage in tools
import { MCPError, MCP_ERROR_CODES } from '../utils/error-handler.js';

if (!validInput) {
  throw new MCPError(
    MCP_ERROR_CODES.INVALID_PARAMS,
    'Input validation failed',
    { providedInput: input }
  );
}
```

## Testing

### Running Tests

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test --watch

# Run tests with coverage
pnpm test:coverage

# Run specific test file
pnpm test test/tools/my-tool.test.ts
```

### Test Structure

The template uses Vitest with a comprehensive test structure:

```typescript
describe('Tool Name', () => {
  describe('Feature Group', () => {
    it('should behave correctly', async () => {
      // Test implementation
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid input', async () => {
      // Error case tests
    });
  });
});
```

## Development Workflow

### Git Hooks

The template includes pre-commit hooks via Husky:

- **Pre-commit**: Runs linting and formatting
- **Commit-msg**: Validates commit message format

### Scripts

```bash
# Development
pnpm dev          # Watch mode development
pnpm build        # Production build
pnpm start        # Start built server

# Quality
pnpm lint         # Run ESLint
pnpm lint:fix     # Fix linting issues
pnpm format       # Format code with Prettier

# Testing
pnpm test         # Run tests
pnpm test:run     # Run tests once
pnpm test:coverage # Run with coverage

# Cleanup
pnpm clean        # Remove built files
```

## Best Practices

### 1. Type Safety
- Use TypeScript strictly for better reliability
- Define proper interfaces for all data structures
- Leverage type inference where appropriate

### 2. Error Handling
- Always handle errors gracefully
- Use proper MCP error codes
- Provide meaningful error messages
- Include context in error responses

### 3. Testing
- Write tests for all tools and functionality
- Include both success and error cases
- Test parameter validation
- Use descriptive test names

### 4. Documentation
- Document your tools and parameters clearly
- Include usage examples
- Maintain up-to-date README files
- Add inline code comments for complex logic

### 5. Security
- Validate all inputs thoroughly
- Implement safety checks for file operations
- Use allowlists for sensitive operations
- Sanitize user-provided data

### 6. Performance
- Use async/await for I/O operations
- Implement proper error timeouts
- Consider memory usage for large operations
- Profile performance-critical paths

### 7. Configuration
- Use environment variables for deployment settings
- Provide sensible defaults
- Validate configuration at startup
- Support runtime configuration updates where appropriate

## Deployment

### Docker Support

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --only=production
COPY dist/ ./dist/
EXPOSE 3000
CMD ["node", "dist/server/index.js"]
```

### Environment Setup

```bash
# Production environment variables
NODE_ENV=production
MCP_SERVER_NAME=my-production-server
MCP_LOG_LEVEL=info
MCP_SERVER_PORT=3000
```

## Contributing

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/my-new-feature`
3. Write tests for your changes
4. Run the test suite: `pnpm test`
5. Ensure code quality: `pnpm lint && pnpm format`
6. Commit your changes: `git commit -am 'Add some feature'`
7. Push to the branch: `git push origin feature/my-new-feature`
8. Submit a pull request

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Resources

- [Model Context Protocol Specification](https://spec.modelcontextprotocol.io/)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)
- [Vitest Documentation](https://vitest.dev/)
- [ESLint Documentation](https://eslint.org/docs/)
- [Prettier Documentation](https://prettier.io/docs/)

---

**Made with ❤️ using the MCP ecosystem tools: mcp-consult, mcp-optimist, and mcp-tdd**
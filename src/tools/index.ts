import type { ToolHandler } from '../types/index.js';
import { TypedTool } from './typed-tool-system.js';
import { fileReaderTool } from './file-reader.js';
import { spriteManagerTool } from './sprite-manager.js';
import { soundEngineTool } from './sound-engine.js';
import { graphicsConverterTool } from './graphics-converter.js';
import { tilemapGeneratorTool } from './tilemap-generator.js';
import { paletteManagerTool } from './palette-manager.js';

// Convert TypedTool to ToolHandler for compatibility
function typedToolToHandler(typedTool: TypedTool): ToolHandler {
  return {
    name: typedTool.name,
    description: typedTool.description,
    parameters: [], // TypedTool uses JSON schema, not this format
    execute: async (params: any) => {
      const result = await typedTool.execute(params);
      return {
        success: result.success,
        content: result.data,
        error: result.error,
      };
    },
  };
}

/**
 * Registry of all available tools for SNES development
 */
export const defaultTools: ToolHandler[] = [
  // SNES Development Tools
  typedToolToHandler(spriteManagerTool),
  typedToolToHandler(soundEngineTool),
  typedToolToHandler(graphicsConverterTool),
  typedToolToHandler(tilemapGeneratorTool),
  typedToolToHandler(paletteManagerTool),

  // Utility Tools
  fileReaderTool,
];

/**
 * Get a tool by name
 */
export function getTool(name: string): ToolHandler | undefined {
  return defaultTools.find(tool => tool.name === name);
}

/**
 * Get all tool names
 */
export function getToolNames(): string[] {
  return defaultTools.map(tool => tool.name);
}

/**
 * Validate tool parameters against schema
 */
export function validateToolParams(
  tool: ToolHandler,
  params: Record<string, any>
): { valid: boolean; error?: string } {
  for (const param of tool.parameters) {
    if (param.required && !(param.name in params)) {
      return {
        valid: false,
        error: `Required parameter '${param.name}' is missing`,
      };
    }

    if (param.name in params) {
      const value = params[param.name];
      const expectedType = param.type;

      let actualType: string;
      if (Array.isArray(value)) {
        actualType = 'array';
      } else if (value === null) {
        actualType = 'null';
      } else {
        actualType = typeof value;
      }

      if (expectedType !== actualType) {
        return {
          valid: false,
          error: `Parameter '${param.name}' expected type '${expectedType}' but got '${actualType}'`,
        };
      }
    }
  }

  return { valid: true };
}

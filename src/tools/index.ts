import type { ToolHandler } from '../types/index.js';
import { TypedTool } from './typed-tool-system.js';
import { fileReaderTool } from './file-reader.js';
import { spriteManagerTool } from './sprite-manager.js';
import { soundEngineTool } from './sound-engine.js';
import { graphicsConverterTool } from './graphics-converter.js';
import { tilemapGeneratorTool } from './tilemap-generator.js';
import { paletteManagerTool } from './palette-manager.js';
// PVSnesLib Setup Tools
import { pvsnesLibInitTool } from './pvsneslib-init.js';
import { pvsnesLibValidateHostTool } from './pvsneslib-validate-host.js';
import { pvsnesLibInstallSDKTool } from './pvsneslib-install-sdk.js';
import { pvsnesLibValidateInstallTool } from './pvsneslib-validate-install.js';
import { pvsnesLibConfigureToolsTool } from './pvsneslib-configure-tools.js';
import { pvsnesLibBuildConfigTool } from './pvsneslib-build-config.js';
import { pvsnesLibBootstrapTool } from './pvsneslib-bootstrap.js';

// Convert TypedTool to ToolHandler for compatibility
function typedToolToHandler(typedTool: TypedTool): ToolHandler {
  // Extract parameters from TypeBox schema
  const parameters: any[] = [];

  if (
    typedTool.inputSchema &&
    typedTool.inputSchema.type === 'object' &&
    typedTool.inputSchema.properties
  ) {
    const properties = typedTool.inputSchema.properties;
    const required = typedTool.inputSchema.required || [];

    for (const [name, propSchema] of Object.entries(properties)) {
      let prop = propSchema as any;

      // Handle Type.Optional wrapper - extract the inner type
      let isRequired = required.includes(name);
      if (prop.anyOf) {
        // Type.Optional creates anyOf: [actualType, null] structure
        prop = prop.anyOf[0];
        isRequired = false;
      }

      const param: any = {
        name,
        description: prop.description || '',
        required: isRequired,
        type: prop.type,
      };

      // Handle array types specifically
      if (prop.type === 'array' && prop.items) {
        param.items = { type: prop.items.type };
      }

      // Handle union types (for optimizationLevel)
      if (prop.anyOf && !prop.type) {
        param.type = 'string'; // Union of literals is treated as string
      }

      parameters.push(param);
    }
  }

  return {
    name: typedTool.name,
    description: typedTool.description,
    parameters,
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
  // SNES Development Tools (TypedTools converted to ToolHandlers)
  typedToolToHandler(spriteManagerTool),
  typedToolToHandler(soundEngineTool),
  typedToolToHandler(graphicsConverterTool),
  typedToolToHandler(tilemapGeneratorTool),
  typedToolToHandler(paletteManagerTool),
  typedToolToHandler(pvsnesLibConfigureToolsTool),

  // PVSnesLib Setup Tools (native ToolHandlers)
  pvsnesLibBootstrapTool,
  pvsnesLibInitTool,
  pvsnesLibValidateHostTool,
  pvsnesLibInstallSDKTool,
  pvsnesLibValidateInstallTool,
  pvsnesLibBuildConfigTool,

  // Utility Tools
  fileReaderTool,
];

/**
 * Registry of TypedTools for direct access to schemas
 */
export const typedTools = [
  spriteManagerTool,
  soundEngineTool,
  graphicsConverterTool,
  tilemapGeneratorTool,
  paletteManagerTool,
  pvsnesLibConfigureToolsTool,
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

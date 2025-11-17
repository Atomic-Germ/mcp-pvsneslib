import { Type, type TSchema } from '@sinclair/typebox';
import { Value } from '@sinclair/typebox/value';

export interface TypedToolDefinition {
  name: string;
  description: string;
  inputSchema: TSchema;
  outputSchema: TSchema;
  handler: (params: any) => Promise<any>;
  examples?: Array<{ input: any; output: any }>;
  tags?: string[];
}

export interface ToolExecutionResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

export class ValidationError extends Error {
  constructor(
    public field: string,
    message: string
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class TypedTool {
  name: string;
  description: string;
  inputSchema: TSchema;
  outputSchema: TSchema;
  handler: (params: any) => Promise<any>;
  examples?: Array<{ input: any; output: any }>;
  tags?: string[];

  constructor(definition: TypedToolDefinition) {
    this.name = definition.name;
    this.description = definition.description;
    this.inputSchema = definition.inputSchema;
    this.outputSchema = definition.outputSchema;
    this.handler = definition.handler;
    this.examples = definition.examples;
    this.tags = definition.tags;
  }

  async execute(params: any): Promise<ToolExecutionResult> {
    try {
      // Validate input
      const errors = [...Value.Errors(this.inputSchema, params)];
      if (errors.length > 0) {
        const errorMessages = errors
          .map(e => `${e.path || 'root'}: ${e.message}`)
          .join('; ');
        return {
          success: false,
          error: `Input validation failed: ${errorMessages}`,
        };
      }

      // Execute handler
      const result = await this.handler(params);

      // Validate output
      const outputErrors = [...Value.Errors(this.outputSchema, result)];
      if (outputErrors.length > 0) {
        const errorMessages = outputErrors
          .map(e => `${e.path || 'root'}: ${e.message}`)
          .join('; ');
        return {
          success: false,
          error: `Output validation failed: ${errorMessages}`,
        };
      }

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  toJSON() {
    return {
      name: this.name,
      description: this.description,
      inputSchema: this.inputSchema,
      outputSchema: this.outputSchema,
      examples: this.examples,
      tags: this.tags,
    };
  }
}

export function createTypedTool(definition: TypedToolDefinition): TypedTool {
  return new TypedTool(definition);
}

export class ToolRegistry {
  private tools = new Map<string, TypedTool>();

  register(tool: TypedTool): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool "${tool.name}" is already registered`);
    }
    this.tools.set(tool.name, tool);
  }

  unregister(toolName: string): boolean {
    return this.tools.delete(toolName);
  }

  get(toolName: string): TypedTool | undefined {
    return this.tools.get(toolName);
  }

  list(): TypedTool[] {
    return Array.from(this.tools.values());
  }

  async execute(toolName: string, params: any): Promise<ToolExecutionResult> {
    const tool = this.get(toolName);
    if (!tool) {
      return {
        success: false,
        error: `Tool "${toolName}" not found`,
      };
    }

    return tool.execute(params);
  }

  getMetadata() {
    return this.list().map(tool => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
      outputSchema: tool.outputSchema,
      examples: tool.examples,
      tags: tool.tags,
    }));
  }
}

export default { createTypedTool, TypedTool, ToolRegistry };

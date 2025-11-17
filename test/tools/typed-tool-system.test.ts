import { describe, it, expect, beforeEach } from 'vitest';
import { Type } from '@sinclair/typebox';
import {
  createTypedTool,
  ToolRegistry,
  ValidationError,
} from '../../src/tools/typed-tool-system.js';

describe('TypedTool System', () => {
  describe('Tool Definition', () => {
    it('should create a typed tool with schema validation', async () => {
      const inputSchema = Type.Object({
        name: Type.String({ description: 'User name' }),
        age: Type.Optional(Type.Number()),
      });

      const outputSchema = Type.Object({
        message: Type.String(),
      });

      const tool = createTypedTool({
        name: 'greet_user',
        description: 'Greets a user by name',
        inputSchema,
        outputSchema,
        handler: async ({ name, age }) => ({
          message: `Hello ${name}${age ? ` (age ${age})` : ''}!`,
        }),
        examples: [
          {
            input: { name: 'Alice' },
            output: { message: 'Hello Alice!' },
          },
        ],
      });

      expect(tool.name).toBe('greet_user');
      expect(tool.description).toBe('Greets a user by name');
      expect(tool.inputSchema).toBeDefined();
      expect(tool.outputSchema).toBeDefined();
      expect(tool.examples).toHaveLength(1);
    });

    it('should validate input parameters at runtime', async () => {
      const inputSchema = Type.Object({
        value: Type.Number({ minimum: 0, maximum: 100 }),
      });

      const tool = createTypedTool({
        name: 'validate_test',
        description: 'Test validation',
        inputSchema,
        outputSchema: Type.Object({ success: Type.Boolean() }),
        handler: async params => ({ success: true }),
      });

      // Valid input should not throw
      const result = await tool.execute({ value: 50 });
      expect(result.success).toBe(true);

      // Invalid input should throw or return error
      const invalidResult = await tool.execute({ value: 150 } as any);
      expect(invalidResult.success).toBe(false);
      expect(invalidResult.error).toBeDefined();
    });

    it('should handle missing required parameters', async () => {
      const inputSchema = Type.Object({
        required_param: Type.String(),
      });

      const tool = createTypedTool({
        name: 'required_test',
        description: 'Test required params',
        inputSchema,
        outputSchema: Type.Object({ ok: Type.Boolean() }),
        handler: async params => ({ ok: true }),
      });

      const result = await tool.execute({} as any);
      expect(result.success).toBe(false);
      expect(result.error).toContain('required_param');
    });
  });

  describe('Tool Registry', () => {
    let registry: ToolRegistry;

    beforeEach(() => {
      registry = new ToolRegistry();
    });

    it('should register and retrieve tools', () => {
      const tool = createTypedTool({
        name: 'test_tool',
        description: 'A test tool',
        inputSchema: Type.Object({ id: Type.String() }),
        outputSchema: Type.Object({ result: Type.String() }),
        handler: async params => ({ result: 'ok' }),
      });

      registry.register(tool);

      const retrieved = registry.get('test_tool');
      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe('test_tool');
    });

    it('should list all registered tools with metadata', () => {
      const tool1 = createTypedTool({
        name: 'tool1',
        description: 'First tool',
        inputSchema: Type.Object({}),
        outputSchema: Type.Object({}),
        handler: async () => ({}),
      });

      const tool2 = createTypedTool({
        name: 'tool2',
        description: 'Second tool',
        inputSchema: Type.Object({}),
        outputSchema: Type.Object({}),
        handler: async () => ({}),
      });

      registry.register(tool1);
      registry.register(tool2);

      const tools = registry.list();
      expect(tools).toHaveLength(2);
      expect(tools[0].name).toBe('tool1');
      expect(tools[1].name).toBe('tool2');
    });

    it('should prevent duplicate tool registration', () => {
      const tool = createTypedTool({
        name: 'duplicate',
        description: 'Test',
        inputSchema: Type.Object({}),
        outputSchema: Type.Object({}),
        handler: async () => ({}),
      });

      registry.register(tool);
      expect(() => registry.register(tool)).toThrow('already registered');
    });

    it('should validate all tool inputs through registry', async () => {
      const tool = createTypedTool({
        name: 'calc',
        description: 'Simple calculator',
        inputSchema: Type.Object({
          a: Type.Number(),
          b: Type.Number(),
        }),
        outputSchema: Type.Object({ sum: Type.Number() }),
        handler: async ({ a, b }) => ({ sum: a + b }),
      });

      registry.register(tool);

      const result = await registry.execute('calc', { a: 5, b: 3 });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.sum).toBe(8);
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle schema validation errors gracefully', async () => {
      const tool = createTypedTool({
        name: 'strict_tool',
        description: 'Test',
        inputSchema: Type.Object({
          count: Type.Integer({ minimum: 1 }),
        }),
        outputSchema: Type.Object({ ok: Type.Boolean() }),
        handler: async () => ({ ok: true }),
      });

      const result = await tool.execute({ count: 0.5 } as any);
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should capture handler execution errors', async () => {
      const tool = createTypedTool({
        name: 'error_tool',
        description: 'Test',
        inputSchema: Type.Object({}),
        outputSchema: Type.Object({}),
        handler: async () => {
          throw new Error('Handler failed');
        },
      });

      const result = await tool.execute({});
      expect(result.success).toBe(false);
      expect(result.error).toContain('Handler failed');
    });
  });
});

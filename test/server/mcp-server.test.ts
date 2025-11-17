import { describe, it, expect, beforeEach } from 'vitest';
import { MCPServer } from '../../src/server/mcp-server.js';
import type { ServerOptions } from '../../src/types/index.js';

describe('MCPServer', () => {
  let server: MCPServer;
  let options: ServerOptions;

  beforeEach(() => {
    options = {
      name: 'test-server',
      version: '1.0.0',
      description: 'Test MCP server',
    };
  });

  describe('Constructor', () => {
    it('should create an MCP server instance with basic configuration', () => {
      server = new MCPServer(options);

      expect(server).toBeDefined();
      expect(server.name).toBe(options.name);
      expect(server.version).toBe(options.version);
      expect(server.description).toBe(options.description);
    });

    it('should initialize with empty tool registry', () => {
      server = new MCPServer(options);

      expect(server.getRegisteredTools()).toEqual([]);
    });
  });

  describe('Tool Registration', () => {
    beforeEach(() => {
      server = new MCPServer(options);
    });

    it('should register a tool successfully', () => {
      const mockTool = {
        name: 'test-tool',
        description: 'A test tool',
        parameters: [],
        execute: async () => ({ success: true, content: 'test' }),
      };

      server.registerTool(mockTool);

      expect(server.getRegisteredTools()).toContain('test-tool');
    });

    it('should unregister a tool successfully', () => {
      const mockTool = {
        name: 'test-tool',
        description: 'A test tool',
        parameters: [],
        execute: async () => ({ success: true, content: 'test' }),
      };

      server.registerTool(mockTool);
      expect(server.getRegisteredTools()).toContain('test-tool');

      const removed = server.unregisterTool('test-tool');
      expect(removed).toBe(true);
      expect(server.getRegisteredTools()).not.toContain('test-tool');
    });

    it('should return false when unregistering non-existent tool', () => {
      const removed = server.unregisterTool('non-existent');
      expect(removed).toBe(false);
    });
  });
});

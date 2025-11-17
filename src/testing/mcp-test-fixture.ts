import { TypedTool } from '../tools/typed-tool-system.js';

/**
 * Simple test fixture for testing MCP tools without full server setup.
 * For full integration testing, use proper MCP SDK clients.
 */
export class MCPTestFixture {
  private tools: Map<string, TypedTool> = new Map();

  constructor() {}

  async init(): Promise<void> {
    // Initialization
  }

  registerTool(tool: TypedTool): void {
    this.tools.set(tool.name, tool);
  }

  async connect(): Promise<void> {
    // Connection setup
  }

  async callTool(
    toolName: string,
    args: Record<string, any>
  ): Promise<{ success: boolean; data?: string; error?: string }> {
    const tool = this.tools.get(toolName);
    if (!tool) {
      return { success: false, error: `Tool not found: ${toolName}` };
    }

    const result = await tool.execute(args);
    if (result.success) {
      return {
        success: true,
        data: JSON.stringify(result.data),
      };
    } else {
      return {
        success: false,
        error: result.error,
      };
    }
  }

  async listTools(): Promise<
    Array<{ name: string; description: string; inputSchema?: any }>
  > {
    return Array.from(this.tools.values()).map(tool => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    }));
  }

  getServerInfo() {
    return { version: '1.0.0' };
  }

  async cleanup(): Promise<void> {
    this.tools.clear();
  }
}

export default MCPTestFixture;

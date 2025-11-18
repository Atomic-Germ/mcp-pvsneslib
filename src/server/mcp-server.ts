import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import type {
  ServerOptions,
  ToolHandler,
  Logger,
  MCPRequest,
  MCPResponse,
} from '../types/index.js';
import { ConsoleLogger } from '../utils/logger.js';
import { ErrorHandler } from '../utils/error-handler.js';

/**
 * Core MCP Server implementation
 */
export class MCPServer {
  public readonly name: string;
  public readonly version: string;
  public readonly description: string;

  private server: Server;
  private logger: Logger;
  private errorHandler: ErrorHandler;
  private tools: Map<string, ToolHandler>;
  private transport?: StdioServerTransport;

  constructor(options: ServerOptions) {
    this.name = options.name;
    this.version = options.version;
    this.description = options.description;

    this.logger = new ConsoleLogger(options.name);
    this.errorHandler = new ErrorHandler(this.logger);
    this.tools = new Map();

    // Initialize MCP SDK server
    this.server = new Server(
      {
        name: this.name,
        version: this.version,
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers();
  }

  /**
   * Set up MCP protocol handlers
   */
  private setupHandlers(): void {
    // Handle tool listing
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const tools = Array.from(this.tools.values()).map(tool => {
        // Debug logging for configure_tools specifically
        if (tool.name === 'pvsneslib_configure_tools') {
          this.logger.debug(`Debug ${tool.name}:`, {
            name: tool.name,
            parametersCount: tool.parameters.length,
            parametersTypes: tool.parameters.map(p => `${p.name}:${p.type}`),
            hasCompilerFlags: tool.parameters.some(p => p.name === 'compilerFlags'),
          });
        }
        
        return {
          name: tool.name,
          description: tool.description,
          inputSchema: {
            type: 'object',
            properties: tool.parameters.reduce(
              (props, param) => {
                const propDef: any = {
                  type: param.type,
                  description: param.description,
                };
                if (param.type === 'array' && param.items) {
                  propDef.items = param.items;
                }
                props[param.name] = propDef;
                return props;
              },
              {} as Record<string, any>
            ),
            required: tool.parameters
              .filter(param => param.required)
              .map(param => param.name),
          },
        };
      });

      this.logger.debug(`Listing ${tools.length} tools`);
      return { tools };
    });

    // Handle tool execution
    this.server.setRequestHandler(CallToolRequestSchema, async request => {
      const { name, arguments: args } = request.params;

      this.logger.debug(`Executing tool: ${name}`, args);

      const tool = this.tools.get(name);
      if (!tool) {
        throw this.errorHandler.methodNotFound(name);
      }

      try {
        const result = await tool.execute(args || {});

        if (result.success) {
          return {
            content: [
              {
                type: 'text',
                text:
                  typeof result.content === 'string'
                    ? result.content
                    : JSON.stringify(result.content, null, 2),
              },
            ],
          };
        } else {
          throw new Error(result.error || 'Tool execution failed');
        }
      } catch (error) {
        const mcpError = this.errorHandler.handleError(error, `Tool ${name}`);
        throw mcpError;
      }
    });
  }

  /**
   * Register a tool handler
   */
  public registerTool(tool: ToolHandler): void {
    this.tools.set(tool.name, tool);
    this.logger.info(`Registered tool: ${tool.name}`);
  }

  /**
   * Unregister a tool handler
   */
  public unregisterTool(name: string): boolean {
    const removed = this.tools.delete(name);
    if (removed) {
      this.logger.info(`Unregistered tool: ${name}`);
    }
    return removed;
  }

  /**
   * Get list of registered tools
   */
  public getRegisteredTools(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * Start the server with stdio transport
   */
  public async start(): Promise<void> {
    try {
      this.transport = new StdioServerTransport();
      await this.server.connect(this.transport);

      this.logger.info(`${this.name} v${this.version} started successfully`);
      this.logger.info(`Registered ${this.tools.size} tools`);
    } catch (error) {
      this.errorHandler.handleError(error, 'Server startup');
      throw error;
    }
  }

  /**
   * Stop the server
   */
  public async stop(): Promise<void> {
    try {
      if (this.transport) {
        await this.server.close();
        this.logger.info('Server stopped successfully');
      }
    } catch (error) {
      this.errorHandler.handleError(error, 'Server shutdown');
      throw error;
    }
  }
}

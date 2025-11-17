import type { FlatServerConfig, ToolConfig, LogLevel } from '../types/index.js';

/**
 * Configuration management system for MCP server
 */
export class ConfigManager {
  private config: FlatServerConfig;

  constructor(defaultConfig: FlatServerConfig) {
    this.config = { ...defaultConfig };
    this.loadEnvironmentVariables();
    this.validateConfig();
  }

  /**
   * Load configuration from environment variables
   */
  private loadEnvironmentVariables(): void {
    if (process.env.MCP_SERVER_NAME) {
      this.config.name = process.env.MCP_SERVER_NAME;
    }

    if (process.env.MCP_SERVER_PORT) {
      const port = parseInt(process.env.MCP_SERVER_PORT, 10);
      if (!isNaN(port)) {
        this.config.port = port;
      }
    }

    if (process.env.MCP_SERVER_HOST) {
      this.config.host = process.env.MCP_SERVER_HOST;
    }

    if (process.env.MCP_LOG_LEVEL) {
      const logLevel = process.env.MCP_LOG_LEVEL as LogLevel;
      if (['debug', 'info', 'warn', 'error'].includes(logLevel)) {
        this.config.logLevel = logLevel;
      }
    }
  }

  /**
   * Validate configuration values
   */
  private validateConfig(): void {
    // Validate port
    if (this.config.port !== undefined) {
      if (this.config.port < 1 || this.config.port > 65535) {
        throw new Error('Port must be between 1 and 65535');
      }
    }

    // Validate log level
    const validLogLevels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    if (!validLogLevels.includes(this.config.logLevel)) {
      throw new Error('Invalid log level');
    }

    // Validate tools configuration
    for (const [toolName, toolConfig] of Object.entries(this.config.tools)) {
      if (typeof toolConfig.enabled !== 'boolean') {
        throw new Error(
          `Invalid configuration: tool '${toolName}' must have 'enabled' boolean property`
        );
      }
    }

    // Additional validation checks
    if (!this.config.name || typeof this.config.name !== 'string') {
      throw new Error(
        'Invalid configuration: name is required and must be a string'
      );
    }

    if (!this.config.version || typeof this.config.version !== 'string') {
      throw new Error(
        'Invalid configuration: version is required and must be a string'
      );
    }
  }

  /**
   * Get the current configuration
   */
  public getConfig(): FlatServerConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  public updateConfig(updates: Partial<FlatServerConfig>): void {
    this.config = { ...this.config, ...updates };
    this.validateConfig();
  }

  /**
   * Get tool configuration
   */
  public getToolConfig(toolName: string): ToolConfig | undefined {
    return this.config.tools[toolName];
  }

  /**
   * Update tool configuration
   */
  public updateToolConfig(
    toolName: string,
    toolConfig: Partial<ToolConfig>
  ): void {
    if (!this.config.tools[toolName]) {
      this.config.tools[toolName] = { enabled: true };
    }

    this.config.tools[toolName] = {
      ...this.config.tools[toolName],
      ...toolConfig,
    };

    // Re-validate after update
    this.validateConfig();
  }

  /**
   * Check if a tool is enabled
   */
  public isToolEnabled(toolName: string): boolean {
    const toolConfig = this.getToolConfig(toolName);
    return toolConfig?.enabled ?? false;
  }

  /**
   * Get all enabled tools
   */
  public getEnabledTools(): string[] {
    return Object.entries(this.config.tools)
      .filter(([, config]) => config.enabled)
      .map(([name]) => name);
  }

  /**
   * Get configuration as JSON string
   */
  public toJSON(): string {
    return JSON.stringify(this.config, null, 2);
  }
}

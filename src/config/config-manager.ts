import type { ServerConfig } from '../types/index.js';

/**
 * Default configuration for the MCP server
 */
const DEFAULT_CONFIG: ServerConfig = {
  server: {
    name: 'mcp-pvsneslib',
    version: '1.0.0',
    description: 'MCP server for SNES development with PVSnesLib',
  },
  logging: {
    level: 'info',
    format: 'text',
  },
  tools: {
    enabled: ['sprite_manager', 'sound_engine', 'graphics_converter', 'tilemap_generator', 'palette_manager'],
    disabled: [],
  },
  security: {
    maxFileSize: 1024 * 1024, // 1MB
    allowedPaths: ['.'],
    blockedPaths: ['/etc', '/root', '/home'],
  },
};

/**
 * Configuration manager for MCP server
 */
export class ConfigManager {
  private config: ServerConfig;

  constructor(customConfig?: Partial<ServerConfig>) {
    this.config = this.loadConfiguration(customConfig);
  }

  /**
   * Load configuration from environment variables and custom config
   */
  private loadConfiguration(customConfig?: Partial<ServerConfig>): ServerConfig {
    let config: ServerConfig = JSON.parse(JSON.stringify(DEFAULT_CONFIG));

    // Override with environment variables
    if (process.env.MCP_SERVER_NAME) {
      config.server.name = process.env.MCP_SERVER_NAME;
    }

    if (process.env.MCP_SERVER_VERSION) {
      config.server.version = process.env.MCP_SERVER_VERSION;
    }

    if (process.env.MCP_SERVER_DESCRIPTION) {
      config.server.description = process.env.MCP_SERVER_DESCRIPTION;
    }

    if (process.env.MCP_LOG_LEVEL) {
      const level = process.env.MCP_LOG_LEVEL.toLowerCase();
      if (['debug', 'info', 'warn', 'error'].includes(level)) {
        config.logging.level = level as 'debug' | 'info' | 'warn' | 'error';
      }
    }

    if (process.env.MCP_LOG_FORMAT) {
      const format = process.env.MCP_LOG_FORMAT.toLowerCase();
      if (['text', 'json'].includes(format)) {
        config.logging.format = format as 'text' | 'json';
      }
    }

    if (process.env.MCP_MAX_FILE_SIZE) {
      const size = parseInt(process.env.MCP_MAX_FILE_SIZE, 10);
      if (!isNaN(size) && size > 0) {
        config.security.maxFileSize = size;
      }
    }

    // Merge with custom configuration
    if (customConfig) {
      config = this.mergeConfigs(config, customConfig);
    }

    return config;
  }

  /**
   * Deep merge two configuration objects
   */
  private mergeConfigs(target: ServerConfig, source: Partial<ServerConfig>): ServerConfig {
    const result = JSON.parse(JSON.stringify(target));

    if (source.server) {
      result.server = { ...result.server, ...source.server };
    }

    if (source.logging) {
      result.logging = { ...result.logging, ...source.logging };
    }

    if (source.tools) {
      result.tools = { ...result.tools, ...source.tools };
    }

    if (source.security) {
      result.security = { ...result.security, ...source.security };
    }

    return result;
  }

  /**
   * Get the current configuration
   */
  public getConfig(): ServerConfig {
    return JSON.parse(JSON.stringify(this.config));
  }

  /**
   * Set custom configuration (merges with existing)
   */
  public setConfig(customConfig: Partial<ServerConfig>): void {
    this.config = this.mergeConfigs(this.config, customConfig);
  }

  /**
   * Reset to default configuration
   */
  public resetConfig(): void {
    this.config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
  }

  /**
   * Get server configuration only
   */
  public getServerConfig(): ServerConfig['server'] {
    return this.config.server;
  }

  /**
   * Get logging configuration only
   */
  public getLoggingConfig(): ServerConfig['logging'] {
    return this.config.logging;
  }

  /**
   * Get tools configuration only
   */
  public getToolsConfig(): ServerConfig['tools'] {
    return this.config.tools;
  }

  /**
   * Get security configuration only
   */
  public getSecurityConfig(): ServerConfig['security'] {
    return this.config.security;
  }

  /**
   * Check if a tool is enabled
   */
  public isToolEnabled(toolName: string): boolean {
    const { enabled, disabled } = this.config.tools;
    
    // If tool is explicitly disabled, return false
    if (disabled.includes(toolName)) {
      return false;
    }

    // If enabled list is empty, all tools are enabled by default
    if (enabled.length === 0) {
      return true;
    }

    // Otherwise, tool must be in enabled list
    return enabled.includes(toolName);
  }
}
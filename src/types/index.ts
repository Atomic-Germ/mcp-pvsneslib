/**
 * Core types for MCP Server Template
 */

export interface ServerOptions {
  name: string;
  version: string;
  description: string;
  capabilities?: ServerCapabilities;
}

export interface ServerCapabilities {
  tools?: {
    listChanged?: boolean;
  };
  resources?: {
    subscribe?: boolean;
    listChanged?: boolean;
  };
  prompts?: {
    listChanged?: boolean;
  };
}

export interface ToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description: string;
  required?: boolean;
  default?: any;
}

export interface ToolResult {
  success: boolean;
  content?: string | object;
  error?: string;
  metadata?: Record<string, any>;
}

export interface ToolHandler {
  name: string;
  description: string;
  parameters: ToolParameter[];
  execute(params: any): Promise<ToolResult>;
}

export interface MCPRequest {
  method: string;
  params?: any;
  id?: string | number;
}

export interface MCPResponse {
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
  id?: string | number;
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface Logger {
  debug(message: string, ...args: any[]): void;
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
}

export interface ToolConfig {
  enabled: boolean;
  [key: string]: any;
}

export interface ToolsConfig {
  enabled: string[];
  disabled: string[];
}

export interface ServerInfo {
  name: string;
  version: string;
  description: string;
}

export interface LoggingConfig {
  level: LogLevel;
  format: 'text' | 'json';
}

export interface SecurityConfig {
  maxFileSize: number;
  allowedPaths: string[];
  blockedPaths: string[];
}

// Nested config structure (used by config-manager.ts)
export interface ServerConfig {
  server: ServerInfo;
  logging: LoggingConfig;
  tools: ToolsConfig;
  security: SecurityConfig;
}

// Flat config structure (used by ConfigManager.ts)
export interface FlatServerConfig {
  name: string;
  version: string;
  description: string;
  port?: number;
  host?: string;
  logLevel: LogLevel;
  tools: Record<string, ToolConfig>;
}

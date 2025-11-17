import type { Logger } from '../types/index.js';

/**
 * Simple console-based logger for MCP server
 */
export class ConsoleLogger implements Logger {
  private prefix: string;

  constructor(name: string = 'MCPServer') {
    this.prefix = `[${name}]`;
  }

  debug(message: string, ...args: any[]): void {
    console.debug(`${this.prefix} DEBUG:`, message, ...args);
  }

  info(message: string, ...args: any[]): void {
    console.info(`${this.prefix} INFO:`, message, ...args);
  }

  warn(message: string, ...args: any[]): void {
    console.warn(`${this.prefix} WARN:`, message, ...args);
  }

  error(message: string, ...args: any[]): void {
    console.error(`${this.prefix} ERROR:`, message, ...args);
  }
}

/**
 * Create a logger instance
 */
export function createLogger(name?: string): Logger {
  return new ConsoleLogger(name);
}
import type { Logger } from '../types/index.js';

/**
 * Standard MCP error codes
 */
export const MCP_ERROR_CODES = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
} as const;

/**
 * MCP Error class for structured error handling
 */
export class MCPError extends Error {
  public code: number;
  public data?: any;

  constructor(code: number, message: string, data?: any) {
    super(message);
    this.name = 'MCPError';
    this.code = code;
    this.data = data;
  }

  toJSON() {
    return {
      code: this.code,
      message: this.message,
      data: this.data,
    };
  }
}

/**
 * Error handler utility class
 */
export class ErrorHandler {
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * Handle and log an error
   */
  handleError(error: unknown, context: string = 'Unknown'): MCPError {
    if (error instanceof MCPError) {
      this.logger.error(`${context}: MCP Error`, error.toJSON());
      return error;
    }

    if (error instanceof Error) {
      this.logger.error(`${context}: ${error.name}`, error.message, error.stack);
      return new MCPError(MCP_ERROR_CODES.INTERNAL_ERROR, error.message);
    }

    const errorMessage = String(error);
    this.logger.error(`${context}: Unknown error`, errorMessage);
    return new MCPError(MCP_ERROR_CODES.INTERNAL_ERROR, errorMessage);
  }

  /**
   * Create a method not found error
   */
  methodNotFound(method: string): MCPError {
    return new MCPError(
      MCP_ERROR_CODES.METHOD_NOT_FOUND,
      `Method '${method}' not found`
    );
  }

  /**
   * Create an invalid params error
   */
  invalidParams(message: string, data?: any): MCPError {
    return new MCPError(MCP_ERROR_CODES.INVALID_PARAMS, message, data);
  }

  /**
   * Create a parse error
   */
  parseError(message: string): MCPError {
    return new MCPError(MCP_ERROR_CODES.PARSE_ERROR, message);
  }
}
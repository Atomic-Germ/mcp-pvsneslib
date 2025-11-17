import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';

export enum ErrorCategory {
  VALIDATION = 'VALIDATION',
  SYSTEM = 'SYSTEM',
  RATE_LIMITED = 'RATE_LIMITED',
  TIMEOUT = 'TIMEOUT',
  UNSUPPORTED = 'UNSUPPORTED',
  UNKNOWN = 'UNKNOWN',
}

export interface LogEntry {
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  service: string;
  message: string;
  correlationId?: string;
  [key: string]: any;
}

export interface ToolExecutionLogData {
  toolName: string;
  duration: number;
  success: boolean;
  statusCode: number;
  error?: string;
  [key: string]: any;
}

export function createCorrelationId(): string {
  return `${Date.now()}-${randomUUID().slice(0, 8)}`;
}

export class StructuredLogger extends EventEmitter {
  private service: string;
  private correlationId?: string;

  constructor(service: string) {
    super();
    this.service = service;
  }

  setCorrelationId(id: string): void {
    this.correlationId = id;
  }

  clearCorrelationId(): void {
    this.correlationId = undefined;
  }

  private createLogEntry(
    level: 'debug' | 'info' | 'warn' | 'error',
    message: string,
    context?: Record<string, any>
  ): LogEntry {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      service: this.service,
      message,
      ...(this.correlationId && { correlationId: this.correlationId }),
      ...context,
    };

    this.emit('log', entry);
    return entry;
  }

  debug(message: string, context?: Record<string, any>): void {
    this.createLogEntry('debug', message, context);
  }

  info(message: string, context?: Record<string, any>): void {
    this.createLogEntry('info', message, context);
  }

  warn(message: string, context?: Record<string, any>): void {
    this.createLogEntry('warn', message, context);
  }

  error(message: string, context?: Record<string, any>): void {
    this.createLogEntry('error', message, context);
  }

  logError(message: string, error: Error, context?: Record<string, any>): void {
    this.createLogEntry('error', message, {
      errorMessage: error.message,
      errorStack: error.stack,
      ...context,
    });
  }

  logToolExecution(data: ToolExecutionLogData): void {
    const level = data.success ? 'info' : 'warn';
    const { toolName, duration, success, statusCode, ...rest } = data;
    this.createLogEntry(level, `Tool execution: ${toolName}`, {
      toolName,
      duration,
      success,
      statusCode,
      ...rest,
    });
  }
}

export default {
  StructuredLogger,
  ErrorCategory,
  createCorrelationId,
};

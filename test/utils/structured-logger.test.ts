import { describe, it, expect } from 'vitest';
import {
  StructuredLogger,
  ErrorCategory,
  createCorrelationId,
} from '../../src/utils/structured-logger.js';

describe('Structured Logger', () => {
  describe('Logging', () => {
    it('should log structured messages with context', () => {
      const logger = new StructuredLogger('test-service');
      const logs: any[] = [];

      logger.on('log', entry => {
        logs.push(entry);
      });

      logger.info('Test message', { userId: '123', action: 'login' });

      expect(logs).toHaveLength(1);
      expect(logs[0].level).toBe('info');
      expect(logs[0].message).toBe('Test message');
      expect(logs[0].service).toBe('test-service');
      expect(logs[0].userId).toBe('123');
      expect(logs[0].action).toBe('login');
    });

    it('should include correlation ID across requests', () => {
      const logger = new StructuredLogger('service');
      const correlationId = createCorrelationId();
      const logs: any[] = [];

      logger.on('log', entry => {
        logs.push(entry);
      });

      logger.setCorrelationId(correlationId);
      logger.info('Step 1');
      logger.info('Step 2');

      expect(logs[0].correlationId).toBe(correlationId);
      expect(logs[1].correlationId).toBe(correlationId);
    });

    it('should log with severity levels', () => {
      const logger = new StructuredLogger('service');
      const logs: any[] = [];

      logger.on('log', entry => {
        logs.push(entry);
      });

      logger.debug('Debug message');
      logger.info('Info message');
      logger.warn('Warning message');
      logger.error('Error message');

      expect(logs[0].level).toBe('debug');
      expect(logs[1].level).toBe('info');
      expect(logs[2].level).toBe('warn');
      expect(logs[3].level).toBe('error');
    });

    it('should include timestamp', () => {
      const logger = new StructuredLogger('service');
      const logs: any[] = [];
      const beforeTime = new Date().getTime();

      logger.on('log', entry => {
        logs.push(entry);
      });

      logger.info('Test');
      const afterTime = new Date().getTime();

      const logTime = new Date(logs[0].timestamp).getTime();
      expect(logTime).toBeGreaterThanOrEqual(beforeTime);
      expect(logTime).toBeLessThanOrEqual(afterTime);
    });
  });

  describe('Error Logging', () => {
    it('should categorize tool validation errors', () => {
      const logger = new StructuredLogger('service');
      const logs: any[] = [];

      logger.on('log', entry => {
        logs.push(entry);
      });

      logger.logError('Tool validation failed', new Error('Invalid input'), {
        errorCategory: ErrorCategory.VALIDATION,
        toolName: 'calculate',
      });

      expect(logs[0].level).toBe('error');
      expect(logs[0].errorCategory).toBe('VALIDATION');
      expect(logs[0].toolName).toBe('calculate');
      expect(logs[0].errorMessage).toBe('Invalid input');
    });

    it('should categorize system errors', () => {
      const logger = new StructuredLogger('service');
      const logs: any[] = [];

      logger.on('log', entry => {
        logs.push(entry);
      });

      logger.logError('Database connection failed', new Error('ECONNREFUSED'), {
        errorCategory: ErrorCategory.SYSTEM,
      });

      expect(logs[0].errorCategory).toBe('SYSTEM');
    });

    it('should categorize rate limit errors', () => {
      const logger = new StructuredLogger('service');
      const logs: any[] = [];

      logger.on('log', entry => {
        logs.push(entry);
      });

      logger.logError('Rate limit exceeded', new Error('Too many requests'), {
        errorCategory: ErrorCategory.RATE_LIMITED,
        retryAfter: 60,
      });

      expect(logs[0].errorCategory).toBe('RATE_LIMITED');
      expect(logs[0].retryAfter).toBe(60);
    });

    it('should categorize timeout errors', () => {
      const logger = new StructuredLogger('service');
      const logs: any[] = [];

      logger.on('log', entry => {
        logs.push(entry);
      });

      logger.logError('Request timeout', new Error('ETIMEDOUT'), {
        errorCategory: ErrorCategory.TIMEOUT,
        duration: 5000,
      });

      expect(logs[0].errorCategory).toBe('TIMEOUT');
      expect(logs[0].duration).toBe(5000);
    });
  });

  describe('Tool Execution Logging', () => {
    it('should log tool execution with duration', () => {
      const logger = new StructuredLogger('service');
      const logs: any[] = [];

      logger.on('log', entry => {
        logs.push(entry);
      });

      logger.logToolExecution({
        toolName: 'greet',
        duration: 123,
        success: true,
        statusCode: 200,
      });

      expect(logs[0].level).toBe('info');
      expect(logs[0].toolName).toBe('greet');
      expect(logs[0].duration).toBe(123);
      expect(logs[0].success).toBe(true);
      expect(logs[0].statusCode).toBe(200);
    });

    it('should log failed tool execution', () => {
      const logger = new StructuredLogger('service');
      const logs: any[] = [];

      logger.on('log', entry => {
        logs.push(entry);
      });

      logger.logToolExecution({
        toolName: 'calculate',
        duration: 45,
        success: false,
        statusCode: 400,
        error: 'Invalid parameters',
      });

      expect(logs[0].success).toBe(false);
      expect(logs[0].statusCode).toBe(400);
      expect(logs[0].error).toBe('Invalid parameters');
    });
  });

  describe('Utilities', () => {
    it('should generate unique correlation IDs', () => {
      const id1 = createCorrelationId();
      const id2 = createCorrelationId();

      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^[a-z0-9-]+$/);
    });
  });
});

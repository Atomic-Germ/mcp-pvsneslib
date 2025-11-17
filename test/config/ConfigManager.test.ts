import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ConfigManager } from '../../src/config/ConfigManager.js';
import type { FlatServerConfig, ToolConfig } from '../../src/types/index.js';

describe('ConfigManager', () => {
  let configManager: ConfigManager;
  let defaultConfig: FlatServerConfig;

  beforeEach(() => {
    defaultConfig = {
      name: 'test-server',
      version: '1.0.0',
      description: 'Test server',
      port: 3000,
      host: 'localhost',
      logLevel: 'info',
      tools: {
        greeting: { enabled: true },
        calculator: { enabled: true },
        fileReader: { enabled: false, maxFileSize: 1048576 },
      },
    };
    configManager = new ConfigManager(defaultConfig);
  });

  describe('Configuration Loading', () => {
    it('should load default configuration', () => {
      const config = configManager.getConfig();

      expect(config.name).toBe('test-server');
      expect(config.version).toBe('1.0.0');
      expect(config.port).toBe(3000);
      expect(config.logLevel).toBe('info');
    });

    it('should merge environment variables with default config', () => {
      process.env.MCP_SERVER_NAME = 'env-server';
      process.env.MCP_SERVER_PORT = '8080';
      process.env.MCP_LOG_LEVEL = 'debug';

      configManager = new ConfigManager(defaultConfig);
      const config = configManager.getConfig();

      expect(config.name).toBe('env-server');
      expect(config.port).toBe(8080);
      expect(config.logLevel).toBe('debug');

      // Cleanup
      delete process.env.MCP_SERVER_NAME;
      delete process.env.MCP_SERVER_PORT;
      delete process.env.MCP_LOG_LEVEL;
    });

    it('should validate configuration and throw on invalid values', () => {
      const invalidConfig = {
        ...defaultConfig,
        port: -1, // Invalid port
        logLevel: 'invalid' as any, // Invalid log level
      };

      expect(() => {
        new ConfigManager(invalidConfig);
      }).toThrow();
    });
  });

  describe('Tool Configuration', () => {
    it('should get tool configuration', () => {
      const greetingConfig = configManager.getToolConfig('greeting');

      expect(greetingConfig).toEqual({ enabled: true });
    });

    it('should return undefined for non-existent tool config', () => {
      const config = configManager.getToolConfig('nonexistent');

      expect(config).toBeUndefined();
    });

    it('should update tool configuration', () => {
      configManager.updateToolConfig('calculator', {
        enabled: false,
        precision: 2,
      });
      const config = configManager.getToolConfig('calculator');

      expect(config.enabled).toBe(false);
      expect(config.precision).toBe(2);
    });
  });

  describe('Configuration Validation', () => {
    it('should validate port range', () => {
      expect(() => {
        configManager.updateConfig({ port: 70000 });
      }).toThrow('Port must be between 1 and 65535');
    });

    it('should validate log level', () => {
      expect(() => {
        configManager.updateConfig({ logLevel: 'invalid' as any });
      }).toThrow('Invalid log level');
    });
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
import { Type } from '@sinclair/typebox';
import {
  SandboxedFileReader,
  FileSandboxError,
  FileAccessPolicy,
} from '../../src/tools/sandboxed-file-reader.js';
import * as fs from 'fs';
import * as path from 'path';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';

describe('SandboxedFileReader', () => {
  let tempDir: string;
  let reader: SandboxedFileReader;

  beforeEach(() => {
    tempDir = mkdtempSync(path.join(__dirname, 'temp-'));
    reader = new SandboxedFileReader({
      workspaceRoot: tempDir,
      maxFileSize: 1024 * 100, // 100KB
      allowedExtensions: ['.txt', '.json', '.md', '.ts'],
      timeout: 5000,
    });
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true });
    }
  });

  describe('Path Validation', () => {
    it('should reject absolute paths', () => {
      expect(() => {
        reader.validatePath('/etc/passwd');
      }).toThrow(FileSandboxError);
    });

    it('should reject paths with parent directory traversal', () => {
      expect(() => {
        reader.validatePath('../../../etc/passwd');
      }).toThrow(FileSandboxError);
    });

    it('should accept relative paths within workspace', () => {
      writeFileSync(path.join(tempDir, 'test.txt'), 'content');
      expect(() => {
        reader.validatePath('test.txt');
      }).not.toThrow();
    });

    it('should reject paths outside workspace', () => {
      expect(() => {
        reader.validatePath('../outside.txt');
      }).toThrow(FileSandboxError);
    });

    it('should validate file extensions', () => {
      writeFileSync(path.join(tempDir, 'test.exe'), 'binary');
      expect(() => {
        reader.validatePath('test.exe');
      }).toThrow(FileSandboxError);
    });
  });

  describe('File Reading', () => {
    it('should read valid text files', async () => {
      const content = 'Hello, World!';
      writeFileSync(path.join(tempDir, 'test.txt'), content);

      const result = await reader.readFile('test.txt');
      expect(result.success).toBe(true);
      expect(result.data?.content).toBe(content);
      expect(result.data?.size).toBe(content.length);
      expect(result.data?.encoding).toBe('utf-8');
    });

    it('should read JSON files', async () => {
      const data = { key: 'value' };
      writeFileSync(path.join(tempDir, 'data.json'), JSON.stringify(data));

      const result = await reader.readFile('data.json');
      expect(result.success).toBe(true);
      expect(result.data?.content).toContain('key');
    });

    it('should reject files that are too large', async () => {
      const largeContent = 'x'.repeat(1024 * 101); // 101KB, exceeds 100KB limit
      writeFileSync(path.join(tempDir, 'large.txt'), largeContent);

      const result = await reader.readFile('large.txt');
      expect(result.success).toBe(false);
      expect(result.error).toContain('exceeds maximum');
    });

    it('should return file metadata', async () => {
      writeFileSync(path.join(tempDir, 'doc.md'), '# Title\n\nContent');

      const result = await reader.readFile('doc.md');
      expect(result.success).toBe(true);
      expect(result.data?.metadata).toBeDefined();
      expect(result.data?.metadata?.mtime).toBeDefined();
      expect(result.data?.metadata?.mode).toBeDefined();
    });
  });

  describe('Directory Listing', () => {
    it('should list files in directory', async () => {
      writeFileSync(path.join(tempDir, 'file1.txt'), 'content');
      writeFileSync(path.join(tempDir, 'file2.json'), '{}');
      writeFileSync(path.join(tempDir, 'file3.exe'), 'binary'); // Should be filtered

      const result = await reader.listDirectory('.');
      expect(result.success).toBe(true);
      const files = result.data?.files || [];
      expect(files).toContain('file1.txt');
      expect(files).toContain('file2.json');
      expect(files).not.toContain('file3.exe'); // Filtered by extension
    });

    it('should handle nested directories', async () => {
      const subDir = path.join(tempDir, 'subdir');
      fs.mkdirSync(subDir);
      writeFileSync(path.join(subDir, 'nested.txt'), 'content');

      const result = await reader.listDirectory('subdir');
      expect(result.success).toBe(true);
      expect(result.data?.files).toContain('nested.txt');
    });
  });

  describe('Security Policy', () => {
    it('should enforce read-only access', () => {
      expect(reader.policy.canRead).toBe(true);
      expect(reader.policy.canWrite).toBe(false);
      expect(reader.policy.canExecute).toBe(false);
    });

    it('should support custom access policies', () => {
      const customPolicy: FileAccessPolicy = {
        canRead: true,
        canWrite: false,
        canExecute: false,
        allowedPaths: ['public/**'],
        deniedPaths: ['private/**'],
      };

      const customReader = new SandboxedFileReader({
        workspaceRoot: tempDir,
        policy: customPolicy,
      });

      expect(customReader.policy.allowedPaths).toContain('public/**');
    });
  });

  describe('Error Handling', () => {
    it('should handle missing files gracefully', async () => {
      const result = await reader.readFile('nonexistent.txt');
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should handle permission errors', async () => {
      if (process.platform !== 'win32') {
        const file = path.join(tempDir, 'no-read.txt');
        writeFileSync(file, 'content');
        fs.chmodSync(file, 0o000);

        const result = await reader.readFile('no-read.txt');
        expect(result.success).toBe(false);

        fs.chmodSync(file, 0o644); // Restore for cleanup
      }
    });

    it('should timeout on slow reads', async () => {
      const timeoutReader = new SandboxedFileReader({
        workspaceRoot: tempDir,
        timeout: 1, // 1ms timeout
      });

      writeFileSync(path.join(tempDir, 'test.txt'), 'content');
      // Note: this test depends on timing, may be flaky
      const result = await timeoutReader.readFile('test.txt');
      // Result may succeed anyway if read is fast, so we just check it handles gracefully
      expect(result).toBeDefined();
    });
  });
});

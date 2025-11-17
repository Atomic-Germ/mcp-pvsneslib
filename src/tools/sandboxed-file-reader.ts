import * as fs from 'fs';
import * as path from 'path';
import * as fsPromises from 'fs/promises';

export class FileSandboxError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FileSandboxError';
  }
}

export interface FileAccessPolicy {
  canRead: boolean;
  canWrite: boolean;
  canExecute: boolean;
  allowedPaths?: string[];
  deniedPaths?: string[];
}

export interface SandboxedFileReaderConfig {
  workspaceRoot: string;
  maxFileSize?: number;
  allowedExtensions?: string[];
  timeout?: number;
  policy?: FileAccessPolicy;
}

export interface FileReadResult {
  success: boolean;
  data?: {
    content: string;
    size: number;
    encoding: string;
    metadata?: Record<string, any>;
  };
  error?: string;
}

export interface DirectoryListResult {
  success: boolean;
  data?: {
    files: string[];
    directories: string[];
  };
  error?: string;
}

export class SandboxedFileReader {
  private workspaceRoot: string;
  private maxFileSize: number;
  private allowedExtensions: Set<string>;
  private timeout: number;
  public policy: FileAccessPolicy;

  constructor(config: SandboxedFileReaderConfig) {
    this.workspaceRoot = path.resolve(config.workspaceRoot);
    this.maxFileSize = config.maxFileSize || 1024 * 1024 * 10; // 10MB default
    this.allowedExtensions = new Set(config.allowedExtensions || []);
    this.timeout = config.timeout || 30000; // 30 seconds default
    this.policy = config.policy || {
      canRead: true,
      canWrite: false,
      canExecute: false,
    };
  }

  validatePath(filePath: string): void {
    if (!this.policy.canRead) {
      throw new FileSandboxError('Read access is denied by policy');
    }

    // Reject absolute paths
    if (path.isAbsolute(filePath)) {
      throw new FileSandboxError('Absolute paths are not allowed');
    }

    // Resolve relative path and ensure it stays within workspace
    const resolvedPath = path.resolve(this.workspaceRoot, filePath);
    const normalizedPath = path.normalize(resolvedPath);

    if (!normalizedPath.startsWith(this.workspaceRoot)) {
      throw new FileSandboxError(
        'Path traversal outside workspace is not allowed'
      );
    }

    // Check file extension if list is provided
    if (this.allowedExtensions.size > 0) {
      const ext = path.extname(filePath);
      if (ext && !this.allowedExtensions.has(ext)) {
        throw new FileSandboxError(
          `File extension "${ext}" is not allowed. Allowed: ${Array.from(this.allowedExtensions).join(', ')}`
        );
      }
    }
  }

  async readFile(filePath: string): Promise<FileReadResult> {
    try {
      this.validatePath(filePath);

      const fullPath = path.resolve(this.workspaceRoot, filePath);

      // Check if file exists
      try {
        await fsPromises.access(fullPath, fs.constants.R_OK);
      } catch {
        return {
          success: false,
          error: `File not found or not readable: ${filePath}`,
        };
      }

      // Get file stats
      const stats = await fsPromises.stat(fullPath);

      if (stats.isDirectory()) {
        return {
          success: false,
          error: `Path is a directory, not a file: ${filePath}`,
        };
      }

      // Check file size
      if (stats.size > this.maxFileSize) {
        return {
          success: false,
          error: `File size (${stats.size} bytes) exceeds maximum allowed (${this.maxFileSize} bytes)`,
        };
      }

      // Read file with timeout
      const content = await Promise.race([
        fsPromises.readFile(fullPath, 'utf-8'),
        new Promise<string>((_, reject) =>
          setTimeout(
            () => reject(new Error('Read operation timed out')),
            this.timeout
          )
        ),
      ]);

      return {
        success: true,
        data: {
          content,
          size: stats.size,
          encoding: 'utf-8',
          metadata: {
            mtime: stats.mtime.toISOString(),
            mode: stats.mode,
            isFile: stats.isFile(),
            isDirectory: stats.isDirectory(),
          },
        },
      };
    } catch (error) {
      if (error instanceof FileSandboxError) {
        return {
          success: false,
          error: error.message,
        };
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async listDirectory(dirPath: string): Promise<DirectoryListResult> {
    try {
      this.validatePath(dirPath);

      const fullPath = path.resolve(this.workspaceRoot, dirPath);

      // Check if directory exists
      try {
        await fsPromises.access(fullPath, fs.constants.R_OK);
      } catch {
        return {
          success: false,
          error: `Directory not found or not readable: ${dirPath}`,
        };
      }

      const stats = await fsPromises.stat(fullPath);
      if (!stats.isDirectory()) {
        return {
          success: false,
          error: `Path is not a directory: ${dirPath}`,
        };
      }

      // List directory contents
      const entries = await fsPromises.readdir(fullPath, {
        withFileTypes: true,
      });

      const files: string[] = [];
      const directories: string[] = [];

      for (const entry of entries) {
        // Filter by allowed extensions for files
        if (entry.isFile()) {
          const ext = path.extname(entry.name);
          if (
            this.allowedExtensions.size === 0 ||
            ext === '' ||
            this.allowedExtensions.has(ext)
          ) {
            files.push(entry.name);
          }
        } else if (entry.isDirectory()) {
          directories.push(entry.name);
        }
      }

      return {
        success: true,
        data: {
          files: files.sort(),
          directories: directories.sort(),
        },
      };
    } catch (error) {
      if (error instanceof FileSandboxError) {
        return {
          success: false,
          error: error.message,
        };
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

export default { SandboxedFileReader, FileSandboxError };

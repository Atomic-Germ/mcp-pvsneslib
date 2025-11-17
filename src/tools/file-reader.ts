import { promises as fs } from 'fs';
import { join, resolve, extname } from 'path';
import type { ToolHandler, ToolResult } from '../types/index.js';

/**
 * File reader tool example with safety checks
 */
export const fileReaderTool: ToolHandler = {
  name: 'read_file',
  description: 'Reads file contents with metadata and safety checks',
  parameters: [
    {
      name: 'path',
      type: 'string',
      description:
        'Path to the file to read (relative to current working directory)',
      required: true,
    },
    {
      name: 'include_metadata',
      type: 'boolean',
      description: 'Include file metadata (size, dates, etc.)',
      required: false,
      default: false,
    },
    {
      name: 'max_size',
      type: 'number',
      description: 'Maximum file size in bytes (default: 1MB)',
      required: false,
      default: 1024 * 1024,
    },
  ],
  async execute(params: {
    path: string;
    include_metadata?: boolean;
    max_size?: number;
  }): Promise<ToolResult> {
    const { path, include_metadata = false, max_size = 1024 * 1024 } = params;

    if (!path || typeof path !== 'string') {
      return {
        success: false,
        error: 'Path parameter is required and must be a string',
      };
    }

    try {
      // Resolve and validate path
      const resolvedPath = resolve(path);

      // Basic security check - ensure we're not trying to read outside reasonable bounds
      if (
        resolvedPath.includes('..') ||
        resolvedPath.startsWith('/etc') ||
        resolvedPath.startsWith('/root')
      ) {
        return {
          success: false,
          error: 'Access to this path is not allowed for security reasons',
        };
      }

      // Check if file exists and get stats
      const stats = await fs.stat(resolvedPath);

      if (!stats.isFile()) {
        return {
          success: false,
          error: 'Specified path is not a file',
        };
      }

      // Check file size
      if (stats.size > max_size) {
        return {
          success: false,
          error: `File size (${stats.size} bytes) exceeds maximum allowed size (${max_size} bytes)`,
        };
      }

      // Read file content
      const content = await fs.readFile(resolvedPath, 'utf8');

      const result: any = {
        content,
        path: resolvedPath,
        size: stats.size,
      };

      if (include_metadata) {
        result.metadata = {
          size: stats.size,
          created: stats.birthtime.toISOString(),
          modified: stats.mtime.toISOString(),
          accessed: stats.atime.toISOString(),
          extension: extname(resolvedPath),
          isReadable: true,
          encoding: 'utf8',
        };
      }

      return {
        success: true,
        content: result,
        metadata: {
          timestamp: new Date().toISOString(),
          operation: 'read_file',
        },
      };
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('ENOENT')) {
          return {
            success: false,
            error: `File not found: ${path}`,
          };
        }
        if (error.message.includes('EACCES')) {
          return {
            success: false,
            error: `Permission denied: ${path}`,
          };
        }
        if (error.message.includes('EISDIR')) {
          return {
            success: false,
            error: `Path is a directory, not a file: ${path}`,
          };
        }
      }

      return {
        success: false,
        error: `Failed to read file: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
};

#!/usr/bin/env node

import { MCPServer } from './mcp-server.js';
import { defaultTools } from '../tools/index.js';

/**
 * Main server entry point
 */
async function main(): Promise<void> {
  const server = new MCPServer({
    name: 'mcp-pvsneslib',
    version: '1.0.0',
    description: 'MCP server for SNES development with PVSnesLib',
  });

  // Register all default tools
  for (const tool of defaultTools) {
    server.registerTool(tool);
  }

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    await server.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await server.stop();
    process.exit(0);
  });

  // Start the server
  try {
    await server.start();
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Only run if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}

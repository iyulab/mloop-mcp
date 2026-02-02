#!/usr/bin/env node
/**
 * mloop-mcp - MCP server for MLoop CLI
 *
 * Exposes MLoop ML.NET MLOps capabilities via Model Context Protocol
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from './server.js';

async function main(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();

  await server.connect(transport);

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    await server.close();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await server.close();
    process.exit(0);
  });
}

main().catch((error: unknown) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

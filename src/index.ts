#!/usr/bin/env node
/**
 * mloop-mcp - MCP server for MLoop CLI
 *
 * Exposes MLoop ML.NET MLOps capabilities via Model Context Protocol
 */

import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { createServer } from './server.js';

// serveStdio answers both protocol eras on one stdin/stdout: a client opening with `initialize`
// (2025-11-25 and earlier) and a 2026-07-28 client (no handshake, `server/discover`) alike.
const connection = serveStdio(() => createServer(), {
  onerror: (error) => console.error('mloop-mcp:', error),
});

// Handle graceful shutdown
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, async () => {
    await connection.close();
    process.exit(0);
  });
}

// The server's `initialize` answer names the installed package's version.
// Runs the built server over stdio, as a client would.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

test('initialize reports the package.json version', async () => {
  const client = new Client({ name: 'version-test', version: '0.0.0' });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [fileURLToPath(new URL('../build/index.js', import.meta.url))],
  });

  await client.connect(transport);
  try {
    const server = client.getServerVersion();
    assert.equal(server?.name, 'mloop-mcp');
    assert.equal(server?.version, manifest.version);
  } finally {
    await client.close();
  }
});

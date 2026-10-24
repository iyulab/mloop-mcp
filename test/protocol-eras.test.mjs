// The server answers both protocol eras over stdio, as a client would open it: a 2025-era client
// with the `initialize` handshake, and a 2026-07-28 client with `server/discover` and no handshake.
// Either way it names the installed package's version and lists every tool.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { Client } from '@modelcontextprotocol/client';

const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const toolCount = (readFileSync(new URL('../src/server.ts', import.meta.url), 'utf8').match(/^ {2}\[\w+Tool, \w+Schema\],$/gm) ?? []).length;

async function open(versionNegotiation) {
  const client = new Client({ name: 'era-test', version: '0.0.0' }, { versionNegotiation });
  await client.connect(new StdioClientTransport({
    command: process.execPath,
    args: [fileURLToPath(new URL('../build/index.js', import.meta.url))],
  }));
  return client;
}

for (const [era, protocol, versionNegotiation] of [
  ['2025-11-25 (initialize)', '2025-11-25', { mode: 'legacy' }],
  ['2026-07-28 (server/discover)', '2026-07-28', { mode: { pin: '2026-07-28' } }],
]) {
  test(`${era}: names the package.json version and lists every tool`, async () => {
    const client = await open(versionNegotiation);
    try {
      assert.equal(client.getNegotiatedProtocolVersion(), protocol);
      const server = client.getServerVersion();
      assert.equal(server?.name, 'mloop-mcp');
      assert.equal(server?.version, manifest.version);

      const { tools } = await client.listTools();
      assert.ok(toolCount > 20, `the tool table in src/server.ts was read (${toolCount} rows)`);
      assert.equal(tools.length, toolCount);
      const train = tools.find(t => t.name === 'mloop_train');
      assert.ok(train?.inputSchema?.properties?.projectPath, 'mloop_train lists its arguments');
    } finally {
      await client.close();
    }
  });
}

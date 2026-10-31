// The README's "Available Tools" table names every tool the server lists, and no tool the server does not have —
// a tool missing from it reads as a tool that does not exist.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { Client } from '@modelcontextprotocol/client';

async function listedTools() {
  const client = new Client({ name: 'readme-tools-test', version: '0.0.0' });
  await client.connect(new StdioClientTransport({
    command: process.execPath,
    args: [fileURLToPath(new URL('../build/index.js', import.meta.url))],
  }));
  try { return (await client.listTools()).tools.map(t => t.name); } finally { await client.close(); }
}

/** The tool names that have a row in the table under "## Available Tools". */
export function tableRows(readme) {
  const section = readme.split(/^## Available Tools\s*$/m)[1]?.split(/^## /m)[0] ?? '';
  return [...section.matchAll(/^\|\s*`(mloop_[a-z_]+)`\s*\|/gm)].map(m => m[1]);
}

test('every listed tool has a row in the README table, and every row is a listed tool', async () => {
  const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8');
  const listed = (await listedTools()).sort();
  const rows = tableRows(readme).sort();
  assert.ok(listed.length >= 31, `the guard saw ${listed.length} tools — it must see the ones it polices`);
  assert.deepEqual(listed.filter(n => !rows.includes(n)), [], 'listed tools the README table never names');
  assert.deepEqual(rows.filter(n => !listed.includes(n)), [], 'README rows for tools the server does not list');
});

test('the scan sees a missing row and a stale one', () => {
  const readme = '## Available Tools\n\n| Tool | Description |\n|---|---|\n| `mloop_train` | x |\n| `mloop_gone` | y |\n\n## Next\n| `mloop_other` | z |\n';
  assert.deepEqual(tableRows(readme), ['mloop_train', 'mloop_gone']);
});

// Every tool the server lists carries the four safety hints, and the table that holds them names exactly those tools —
// an approval policy reads these, so a tool without them (or a hint table with a tool the server no longer has) is a defect.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { Client } from '@modelcontextprotocol/client';
import { TOOL_HINTS, hintsFor } from '../build/tool-hints.js';

async function listedTools() {
  const client = new Client({ name: 'hints-test', version: '0.0.0' });
  await client.connect(new StdioClientTransport({
    command: process.execPath,
    args: [fileURLToPath(new URL('../build/index.js', import.meta.url))],
  }));
  try { return (await client.listTools()).tools; } finally { await client.close(); }
}

const FIELDS = ['readOnlyHint', 'destructiveHint', 'idempotentHint', 'openWorldHint'];

test('every listed tool carries all four hints, as booleans', async () => {
  const tools = await listedTools();
  assert.ok(tools.length >= 31, `the guard saw ${tools.length} tools — it must see the ones it polices`);
  for (const tool of tools)
    for (const field of FIELDS)
      assert.equal(typeof tool.annotations?.[field], 'boolean', `${tool.name} has no ${field}`);
});

test('the hint table names exactly the listed tools', async () => {
  const listed = (await listedTools()).map(t => t.name).sort();
  assert.deepEqual(Object.keys(TOOL_HINTS).sort(), listed);
});

test('a read-only tool is not destructive, and a tool that writes is not read-only', async () => {
  for (const [name, h] of Object.entries(TOOL_HINTS)) {
    if (h.readOnlyHint) assert.equal(h.destructiveHint, false, `${name} is read-only yet destructive`);
    if (h.destructiveHint) assert.equal(h.readOnlyHint, false, `${name} is destructive yet read-only`);
  }
  assert.equal(TOOL_HINTS.mloop_list.readOnlyHint, true);       // the guard can tell the two apart
  assert.equal(TOOL_HINTS.mloop_threshold.readOnlyHint, false); // `clear` deletes
  assert.equal(TOOL_HINTS.mloop_threshold.destructiveHint, true);
});

test('a tool without hints is refused', () => {
  assert.throws(() => hintsFor('mloop_not_a_tool'), /no safety hints/);
});

test('the package ships its LICENSE', () => {
  const root = new URL('..', import.meta.url);
  assert.ok(existsSync(new URL('LICENSE', root)), 'LICENSE is missing from the repository root');
  assert.match(readFileSync(new URL('LICENSE', root), 'utf8'), /^MIT License/);
  const packed = JSON.parse(execFileSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], { cwd: fileURLToPath(root), encoding: 'utf8' }));
  assert.ok(packed[0].files.some(f => f.path === 'LICENSE'), 'LICENSE is not in the npm tarball');
});

// mloop_serve against a stand-in for `mloop` (MLOOP_PATH): the call returns once /health answers and the server keeps
// running after it; a server that exits first is reported with its output.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { Client } from '@modelcontextprotocol/client';

const dir = mkdtempSync(join(tmpdir(), 'mloop-mcp-serve-'));
const fake = join(dir, 'mloop');
writeFileSync(fake, `#!/usr/bin/env node
const port = Number(process.argv[process.argv.indexOf('--port') + 1]);
if (process.env.FAKE_MODE === 'fail') { console.error('No production model for default'); process.exit(1); }
setTimeout(() => require('http').createServer((q, s) => { s.end(q.url === '/health' ? 'ok' : ''); }).listen(port, '127.0.0.1'), 700);
`);
chmodSync(fake, 0o755);

async function open(env) {
  const client = new Client({ name: 'serve-test', version: '0.0.0' });
  await client.connect(new StdioClientTransport({
    command: process.execPath,
    args: [fileURLToPath(new URL('../build/index.js', import.meta.url))],
    env: { ...process.env, MLOOP_PATH: fake, ...env },
  }));
  return client;
}

test('returns once /health answers, and the server outlives the call', async () => {
  const port = 41000 + Math.floor(Math.random() * 2000);
  const client = await open({});
  let pid;
  try {
    const answer = await client.callTool({ name: 'mloop_serve', arguments: { projectPath: dir, port } });
    assert.ok(!answer.isError, answer.content[0].text);
    const started = JSON.parse(answer.content[0].text);
    pid = started.pid;
    assert.equal(started.url, `http://127.0.0.1:${port}`);
    await client.close();
    assert.equal((await fetch(`${started.url}/health`)).ok, true, 'still serving after the MCP server closed');
  } finally {
    if (pid) process.kill(-pid, 'SIGTERM');
  }
});

test('a server that exits first is an error that carries its output', async () => {
  const client = await open({ FAKE_MODE: 'fail' });
  try {
    const answer = await client.callTool({ name: 'mloop_serve', arguments: { projectPath: dir, port: 43999 } });
    assert.equal(answer.isError, true);
    assert.match(answer.content[0].text, /exited \(code 1\)[\s\S]*No production model/);
  } finally {
    await client.close();
  }
});

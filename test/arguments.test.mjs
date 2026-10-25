// Every argument reaches mloop exactly as the caller gave it — a quote, `$(…)` or `;` in a text, a file name or a
// label is data, not shell syntax.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, chmodSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { Client } from '@modelcontextprotocol/client';

const dir = mkdtempSync(join(tmpdir(), 'mloop-mcp-args-'));
const fake = join(dir, 'mloop');
const record = join(dir, 'argv.json');
writeFileSync(fake, `#!/usr/bin/env node
require('fs').writeFileSync(${JSON.stringify(record)}, JSON.stringify(process.argv.slice(2)));
process.stdout.write('{}');
`);
chmodSync(fake, 0o755);

test('arguments are passed as given, never through a shell', async () => {
  const marker = join(dir, 'ran');
  const hostile = [`a"; touch ${marker}; echo "b`, `$(touch ${marker})`, '`touch x`', "it's  two  spaces", 'semi;colon'];
  const client = new Client({ name: 'args-test', version: '0.0.0' });
  await client.connect(new StdioClientTransport({
    command: process.execPath,
    args: [fileURLToPath(new URL('../build/index.js', import.meta.url))],
    env: { ...process.env, MLOOP_PATH: fake },
  }));
  try {
    for (const value of hostile) {
      const answer = await client.callTool({ name: 'mloop_info', arguments: { projectPath: dir, dataFile: value, label: value } });
      assert.ok(!answer.isError, answer.content[0].text);
      assert.equal(existsSync(marker), false, `no shell ran ${value}`);
      const argv = JSON.parse(readFileSync(record, 'utf8'));
      assert.equal(argv[1], value, 'the file name arrives as given');
      assert.equal(argv[argv.indexOf('--label') + 1], value, 'the label arrives as given');
    }
  } finally {
    await client.close();
  }
});

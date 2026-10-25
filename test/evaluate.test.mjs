// mloop_evaluate with a test file and no experiment evaluates production on that file: the CLI takes the file only
// after an experiment id, so the tool reads production's id from `mloop list --json` instead of dropping the file.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, chmodSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { Client } from '@modelcontextprotocol/client';

const dir = mkdtempSync(join(tmpdir(), 'mloop-mcp-evaluate-'));
const fake = join(dir, 'mloop');
const record = join(dir, 'calls.jsonl');
writeFileSync(fake, `#!/usr/bin/env node
const args = process.argv.slice(2);
require('fs').appendFileSync(${JSON.stringify(record)}, JSON.stringify(args) + '\\n');
if (args[0] === 'list') process.stdout.write(JSON.stringify({ model: null, experiments: [], production: process.env.FAKE_NONE ? {} : { default: 'exp-007' } }));
else process.stdout.write('{"metrics":{}}');
`);
chmodSync(fake, 0o755);

async function evaluate(args, env = {}) {
  writeFileSync(record, '');
  const client = new Client({ name: 'evaluate-test', version: '0.0.0' });
  await client.connect(new StdioClientTransport({
    command: process.execPath,
    args: [fileURLToPath(new URL('../build/index.js', import.meta.url))],
    env: { ...process.env, MLOOP_PATH: fake, ...env },
  }));
  try {
    const answer = await client.callTool({ name: 'mloop_evaluate', arguments: { projectPath: dir, ...args } });
    return { answer, calls: readFileSync(record, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)) };
  } finally {
    await client.close();
  }
}

test('a test file without an experiment evaluates production on that file', async () => {
  const { answer, calls } = await evaluate({ dataFile: 'holdout.csv' });
  assert.ok(!answer.isError, answer.content[0].text);
  assert.deepEqual(calls.at(-1).slice(0, 3), ['evaluate', 'exp-007', 'holdout.csv']);
});

test('without a production model it says so instead of evaluating something else', async () => {
  const { answer, calls } = await evaluate({ dataFile: 'holdout.csv' }, { FAKE_NONE: '1' });
  assert.equal(answer.isError, true);
  assert.match(answer.content[0].text, /No production model/);
  assert.ok(calls.every(c => c[0] !== 'evaluate'));
});

test('an experiment and a file are passed as given', async () => {
  const { calls } = await evaluate({ experimentId: 'exp-002', dataFile: 'holdout.csv' });
  assert.deepEqual(calls, [['evaluate', 'exp-002', 'holdout.csv', '--json']]);
});

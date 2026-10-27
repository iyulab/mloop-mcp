// Every task the CLI has can be started through the tools, and the learning options the CLI added for those tasks reach it:
// an agent that cannot name `image-anomaly` or pass `--bank-size` cannot drive a CLI that has them.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, chmodSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { Client } from '@modelcontextprotocol/client';
import { MLOOP_TASKS } from '../build/tasks.js';

const dir = mkdtempSync(join(tmpdir(), 'mloop-mcp-tasks-'));
const fake = join(dir, 'mloop');
const record = join(dir, 'argv.json');
writeFileSync(fake, `#!/usr/bin/env node
require('fs').writeFileSync(${JSON.stringify(record)}, JSON.stringify(process.argv.slice(2)));
process.stdout.write('{}');
`);
chmodSync(fake, 0o755);

async function withClient(fn) {
  const client = new Client({ name: 'tasks-test', version: '0.0.0' });
  await client.connect(new StdioClientTransport({
    command: process.execPath,
    args: [fileURLToPath(new URL('../build/index.js', import.meta.url))],
    env: { ...process.env, MLOOP_PATH: fake },
  }));
  try { return await fn(client); } finally { await client.close(); }
}

const argv = () => JSON.parse(readFileSync(record, 'utf8'));

test('mloop_init starts a project of every task the CLI has', async () => {
  assert.equal(MLOOP_TASKS.length, 16);
  await withClient(async client => {
    for (const task of MLOOP_TASKS) {
      await client.callTool({ name: 'mloop_init', arguments: { projectPath: dir, task } });
      const args = argv();
      assert.equal(args[args.indexOf('--task') + 1], task);
    }
  });
});

test('a task the CLI does not have is refused before the CLI runs', async () => {
  await withClient(async client => {
    writeFileSync(record, '[]');
    const answer = await client.callTool({ name: 'mloop_init', arguments: { projectPath: dir, task: 'telepathy' } });
    assert.ok(answer.isError);
    assert.deepEqual(argv(), []);
  });
});

test('mloop_train passes the image-anomaly, ranking and sampling options as CLI flags', async () => {
  await withClient(async client => {
    await client.callTool({
      name: 'mloop_train',
      arguments: {
        projectPath: dir, dataFile: 'pictures', task: 'image-anomaly', encoder: 'dinov2-small', bankSize: 5000,
        groupColumn: 'query', maxRows: 1000, samplingStrategy: 'stratified', seed: 7, records: 'data.items',
      },
    });
    const args = argv();
    const value = flag => args[args.indexOf(flag) + 1];
    assert.equal(args[0], 'train');
    assert.equal(value('--task'), 'image-anomaly');
    assert.equal(value('--encoder'), 'dinov2-small');
    assert.equal(value('--bank-size'), '5000');
    assert.equal(value('--group-column'), 'query');
    assert.equal(value('--max-rows'), '1000');
    assert.equal(value('--sampling-strategy'), 'stratified');
    assert.equal(value('--seed'), '7');
    assert.equal(value('--records'), 'data.items');
  });
});

test('mloop_quick_start needs no label for a task that learns without one', async () => {
  await withClient(async client => {
    await client.callTool({ name: 'mloop_quick_start', arguments: { projectPath: join(dir, 'qs'), dataFile: 'pictures', task: 'image-anomaly' } });
    const args = argv();
    assert.equal(args[0], 'train');
    assert.ok(!args.includes('--label'));
  });
});

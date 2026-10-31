// The command lines of mloop_explain, mloop_runtime, mloop_docker and mloop_encoder's `add`, against a stand-in for
// `mloop` (MLOOP_PATH) that records its arguments.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, chmodSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'mloop-mcp-new-tools-'));
const calls = join(dir, 'calls.jsonl');
const fake = join(dir, 'mloop');
writeFileSync(fake, `#!/usr/bin/env node
require('fs').appendFileSync(${JSON.stringify(calls)}, JSON.stringify(process.argv.slice(2)) + '\\n');
process.stdout.write('{}');
`);
chmodSync(fake, 0o755);
process.env.MLOOP_PATH = fake;

const { explain } = await import('../build/tools/explain.js');
const { runtime } = await import('../build/tools/runtime.js');
const { docker } = await import('../build/tools/docker.js');
const { encoder } = await import('../build/tools/encoder.js');

const last = () => JSON.parse(readFileSync(calls, 'utf8').trim().split('\n').pop());
const calledOnce = async (run) => {
  writeFileSync(calls, '');
  const answer = await run();
  return { answer, args: readFileSync(calls, 'utf8').trim() ? last() : null };
};

test('explain names the experiment positionally, passes every dial, and asks for JSON', async () => {
  const { args } = await calledOnce(() => explain({
    projectPath: dir, experimentId: 'exp-003', modelName: 'm', dataFile: 't.csv', weight: 'w', repeats: 5, rows: 500, seed: 7, records: 'a.b',
  }));
  assert.deepEqual(args.slice(0, 2), ['explain', 'exp-003']);
  for (const [flag, value] of [['--name', 'm'], ['--data', 't.csv'], ['--weight', 'w'], ['--repeats', '5'], ['--rows', '500'], ['--seed', '7'], ['--records', 'a.b']])
    assert.equal(args[args.indexOf(flag) + 1], value, `${flag}: ${args.join(' ')}`);
  assert.ok(args.includes('--json'), args.join(' '));
});

test('explain with no options explains the production model', async () => {
  const { args } = await calledOnce(() => explain({ projectPath: dir }));
  assert.deepEqual(args, ['explain', '--json']);
});

test('runtime list asks for JSON, install is quiet, remove names the runtime', async () => {
  assert.deepEqual((await calledOnce(() => runtime({ projectPath: dir, action: 'list' }))).args, ['runtime', 'list', '--json']);
  assert.deepEqual((await calledOnce(() => runtime({ projectPath: dir, action: 'install', runtime: 'torch' }))).args, ['runtime', 'install', 'torch', '--quiet']);
  assert.deepEqual((await calledOnce(() => runtime({ projectPath: dir, action: 'remove', runtime: 'tf' }))).args, ['runtime', 'remove', 'tf']);
});

test('runtime install and remove without a runtime are refused before the CLI is called', async () => {
  for (const action of ['install', 'remove']) {
    const { answer, args } = await calledOnce(() => runtime({ projectPath: dir, action }));
    assert.equal(answer.isError, true);
    assert.equal(args, null);
  }
});

test('docker passes the model and the port', async () => {
  assert.deepEqual((await calledOnce(() => docker({ projectPath: dir }))).args, ['docker']);
  const { args } = await calledOnce(() => docker({ projectPath: dir, modelName: 'm', port: 8080 }));
  assert.deepEqual(args, ['docker', '--name', 'm', '--port', '8080']);
});

test('encoder add passes the definition, the graph and, for a text encoder, the tokenizer', async () => {
  const bare = await calledOnce(() => encoder({ projectPath: dir, action: 'add', definition: 'e.json', model: 'm.onnx' }));
  assert.deepEqual(bare.args, ['encoder', 'add', 'e.json', '--model', 'm.onnx']);
  const text = await calledOnce(() => encoder({ projectPath: dir, action: 'add', definition: 'e.json', model: 'm.onnx', tokenizer: 't.model' }));
  assert.deepEqual(text.args, ['encoder', 'add', 'e.json', '--model', 'm.onnx', '--tokenizer', 't.model']);
});

test('encoder add without its definition or graph is refused before the CLI is called', async () => {
  for (const params of [{ model: 'm.onnx' }, { definition: 'e.json' }, {}]) {
    const { answer, args } = await calledOnce(() => encoder({ projectPath: dir, action: 'add', ...params }));
    assert.equal(answer.isError, true);
    assert.equal(args, null);
  }
});

// mloop_train over stdio against a stand-in for `mloop` (MLOOP_PATH) that writes `train --json` events: the call
// reports progress when it carries a progress token, answers the run's result and warnings, reports the run's own
// error events when it fails, and stops the process when the call is cancelled.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, chmodSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { Client } from '@modelcontextprotocol/client';

const dir = mkdtempSync(join(tmpdir(), 'mloop-mcp-train-'));
const fake = join(dir, 'mloop');
// FAKE_MODE: ok | fail | slow. `slow` records its pid and that it was stopped.
writeFileSync(fake, `#!/usr/bin/env node
const mode = process.env.FAKE_MODE;
const out = (o) => process.stdout.write(JSON.stringify(o) + '\\n');
if (mode === 'fail') {
  out({ event: 'error', message: "Label column 'nope' not found" });
  process.stderr.write('Error: Label column nope not found\\n');
  process.exit(1);
}
if (mode === 'slow') {
  require('fs').writeFileSync(process.env.FAKE_PID, String(process.pid));
  process.on('SIGTERM', () => { require('fs').writeFileSync(process.env.FAKE_STOPPED, 'yes'); process.exit(143); });
  out({ event: 'phase', phase: 'main', timeLimitSec: 60 });
  setInterval(() => out({ event: 'trial', n: 1, trainer: 'FastTree (NumberOfLeaves=4)', metric: 'auc', value: 0.9 }), 200);
} else {
  out({ event: 'phase', phase: 'main', timeLimitSec: 2 });
  let n = 0;
  const t = setInterval(() => {
    n++;
    out({ event: 'trial', n, trainer: 'FastForest (NumberOfTrees=4)', metric: 'r_squared', value: 0.5 + n / 100 });
    if (n === 3) out({ event: 'warning', message: 'few rows' });
    if (n === 6) {
      clearInterval(t);
      out({ event: 'phase', phase: 'complete', trials: 6 });
      out({ event: 'result', model: 'default', experimentId: 'exp-001', metrics: { r_squared: 0.56 }, args: process.argv.slice(2) });
    }
  }, 300);
}
`);
chmodSync(fake, 0o755);

async function open(env) {
  const client = new Client({ name: 'train-test', version: '0.0.0' });
  await client.connect(new StdioClientTransport({
    command: process.execPath,
    args: [fileURLToPath(new URL('../build/index.js', import.meta.url))],
    env: { ...process.env, MLOOP_PATH: fake, ...env },
  }));
  return client;
}

test('reports progress per trial and answers the result with its warnings', async () => {
  const client = await open({ FAKE_MODE: 'ok' });
  try {
    const seen = [];
    const answer = await client.callTool(
      { name: 'mloop_train', arguments: { projectPath: dir, label: 'y', time: 2 } },
      { onprogress: (p) => seen.push(p) });
    assert.ok(!answer.isError, answer.content?.[0]?.text);
    const outcome = JSON.parse(answer.content[0].text);
    assert.equal(outcome.result.experimentId, 'exp-001');
    assert.deepEqual(outcome.warnings, ['few rows']);
    assert.ok(outcome.result.args.includes('--json'), 'the run was asked for its events');
    assert.ok(seen.length >= 2, `progress was reported (${seen.length})`);
    assert.ok(seen.some(p => /^trial \d+: FastForest r_squared 0\.5\d+ · \d+\.\d s of a 2 s budget$/.test(p.message)),
      seen.map(p => p.message).join(' | '));
    for (let i = 1; i < seen.length; i++) assert.ok(seen[i].progress > seen[i - 1].progress, 'progress rises with every notification');
  } finally {
    await client.close();
  }
});

test('a failed run answers its own error events', async () => {
  const client = await open({ FAKE_MODE: 'fail' });
  try {
    const answer = await client.callTool({ name: 'mloop_train', arguments: { projectPath: dir, label: 'nope' } });
    assert.equal(answer.isError, true);
    assert.equal(answer.content[0].text, "Label column 'nope' not found");
  } finally {
    await client.close();
  }
});

test('cancelling the call stops the run', async () => {
  const pidFile = join(dir, 'pid');
  const stopped = join(dir, 'stopped');
  const client = await open({ FAKE_MODE: 'slow', FAKE_PID: pidFile, FAKE_STOPPED: stopped });
  try {
    const abort = new AbortController();
    const call = client.callTool(
      { name: 'mloop_train', arguments: { projectPath: dir } },
      { signal: abort.signal, onprogress: () => {} });
    for (let i = 0; i < 50 && !existsSync(pidFile); i++) await new Promise(r => setTimeout(r, 100));
    assert.ok(existsSync(pidFile), 'the run started');
    abort.abort();
    await assert.rejects(call);
    for (let i = 0; i < 50 && !existsSync(stopped); i++) await new Promise(r => setTimeout(r, 100));
    assert.equal(existsSync(stopped) && readFileSync(stopped, 'utf8'), 'yes', 'the process was stopped, not left running');
  } finally {
    await client.close();
  }
});

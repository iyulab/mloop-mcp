// A run that only checks the data (`mloop train --analyze-data`) trains nothing: its answer is the `analysis` event, and
// `--generate-script` adds a `script` event. `mloop_train` hands both on, and maps `autoTime` to the CLI's two flags.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, chmodSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'mloop-mcp-analysis-'));
const calls = join(dir, 'calls.jsonl');
const fake = join(dir, 'mloop');
writeFileSync(fake, `#!/usr/bin/env node
require('fs').appendFileSync(${JSON.stringify(calls)}, JSON.stringify(process.argv.slice(2)) + '\\n');
if (process.argv.includes('--analyze-data')) {
  console.log(JSON.stringify({ event: 'analysis', issues: [{ type: 'DuplicateRows', severity: 'high', description: '3 duplicate rows', suggestedFix: 'drop-duplicates' }] }));
  if (process.argv.includes('--generate-script')) console.log(JSON.stringify({ event: 'script', path: process.argv[process.argv.indexOf('--generate-script') + 1] }));
}
`);
chmodSync(fake, 0o755);
process.env.MLOOP_PATH = fake;

const { train } = await import('../build/tools/train.js');
const { runTraining } = await import('../build/training-run.js');

const lastCall = () => JSON.parse(readFileSync(calls, 'utf8').trim().split('\n').pop());

test('the analysis event is the answer of a run that trains nothing', async () => {
  const outcome = await runTraining(['train', '--analyze-data'], dir, undefined);
  assert.equal(outcome.result, null);
  assert.equal(outcome.analysis.issues[0].type, 'DuplicateRows');
  assert.equal(outcome.script, null);
});

test('mloop_train with analyzeData and generateScript answers the findings and the script path', async () => {
  const answer = await train({ projectPath: dir, dataFile: 'd.csv', analyzeData: true, generateScript: 'clean.cs' });
  const outcome = JSON.parse(answer.content[0].text);
  assert.ok(!answer.isError, answer.content[0].text);
  assert.equal(outcome.analysis.issues.length, 1);
  assert.equal(outcome.script.path, 'clean.cs');
  const args = lastCall();
  assert.ok(args.includes('--analyze-data') && args.includes('--json'), args.join(' '));
});

test('autoTime true is --auto-time, false is --no-auto-time, and leaving it out passes neither', async () => {
  await train({ projectPath: dir, dataFile: 'd.csv', autoTime: true });
  assert.ok(lastCall().includes('--auto-time') && !lastCall().includes('--no-auto-time'), lastCall().join(' '));
  await train({ projectPath: dir, dataFile: 'd.csv', autoTime: false });
  assert.ok(lastCall().includes('--no-auto-time') && !lastCall().includes('--auto-time'), lastCall().join(' '));
  await train({ projectPath: dir, dataFile: 'd.csv' });
  assert.ok(!lastCall().includes('--auto-time') && !lastCall().includes('--no-auto-time'), lastCall().join(' '));
});

test('autoMerge is passed as --auto-merge', async () => {
  await train({ projectPath: dir, autoMerge: true });
  assert.ok(lastCall().includes('--auto-merge'), lastCall().join(' '));
});

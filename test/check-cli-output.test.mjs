/**
 * `scripts/check-cli-output.mjs` against a stand-in `mloop` that prints what the check reads: the fields the code
 * declares in src/cli-fields.ts, then again with one renamed. The check is only worth having if it fails for the rename —
 * a guard that has never been shown the shape it forbids reports "ok" both when the CLI is right and when it cannot see.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const script = new URL('../scripts/check-cli-output.mjs', import.meta.url).pathname;

/** A stand-in CLI: `rename` maps a field the real CLI prints to the name this one prints instead (`kind.field=newName`). */
function standIn(rename = {}, omitKinds = []) {
  const dir = mkdtempSync(join(tmpdir(), 'mloop-mcp-standin-'));
  const file = join(dir, 'mloop');
  writeFileSync(file, `#!/usr/bin/env node
const rename = ${JSON.stringify(rename)};
const omit = ${JSON.stringify(omitKinds)};
const args = process.argv.slice(2);
const name = (kind, field) => rename[kind + '.' + field] ?? field;
const event = (kind, fields) => {
  if (omit.includes(kind)) return;
  const o = { [name('train', 'event')]: kind };
  for (const [k, v] of Object.entries(fields)) o[name('train#' + kind, k)] = v;
  console.log(JSON.stringify(o));
};
if (args[0] === 'train' && args.includes('datasets/missing.csv')) {
  event('error', { message: 'no such file' });
  process.exit(1);
} else if (args[0] === 'train') {
  event('phase', { phase: 'search' });
  event('trial', { metric: 'auc', trainer: 'FastTree', value: 0.9 });
  event('result', { experimentId: 'exp-001' });
  event('promotion', { promoted: true });
} else if (args[0] === 'list') {
  console.log(JSON.stringify({ [name('list', 'production')]: { default: 'exp-001' } }));
}
`);
  chmodSync(file, 0o755);
  return file;
}

function check(mloop) {
  return spawnSync(process.execPath, [script, mloop], { encoding: 'utf8' });
}

test('every declared field present: the check passes', () => {
  const result = check(standIn());
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /^ok /m);
});

test('a renamed field fails the check and names it', () => {
  const result = check(standIn({ 'train#result.experimentId': 'expId' }));
  assert.equal(result.status, 1);
  assert.match(result.stderr, /train#result: no "result" event has "experimentId" \(fields seen: .*expId/);
});

test('a renamed event kind field fails every line of the stream', () => {
  const result = check(standIn({ 'train.event': 'type' }));
  assert.equal(result.status, 1);
  assert.match(result.stderr, /train: \d+ of \d+ lines have no "event"/);
});

test('a renamed document field fails the check', () => {
  const result = check(standIn({ 'list.production': 'live' }));
  assert.equal(result.status, 1);
  assert.match(result.stderr, /list: the answer has no "production"/);
});

test('a missing kind of event is reported rather than passing for nothing judged', () => {
  const result = check(standIn({}, ['promotion']));
  assert.equal(result.status, 1);
  assert.match(result.stderr, /train#promotion: the CLI printed no "promotion" event/);
});

test('a warning event a run need not print is only noted when absent', () => {
  const result = check(standIn());
  assert.equal(result.status, 0);
  assert.match(result.stdout, /note: train#warning: this run printed none/);
});

#!/usr/bin/env node
/**
 * Checks that the JSON fields this server reads by name are in what the real CLI prints.
 *
 * The fields are declared in `src/cli-fields.ts` (every read in the code goes through it, and the compiler refuses a
 * read of a field that is not declared). This runs the real `mloop` — a project of its own in a temporary directory,
 * a short training run, a run that fails, `list` — and reports every declared field that is missing from what the CLI
 * printed. The CLI is the authority, not this repository's idea of it; it is the output-side twin of
 * `check-cli-options.mjs`, which checks the options the tools pass.
 *
 * Usage: npm run build && node scripts/check-cli-output.mjs [path-to-mloop]   (default: mloop on PATH)
 *
 * An event kind a healthy run need not print (`warning`) is only noted when absent; every other kind a declaration names
 * must be there, or the check says it exercised nothing it could judge.
 *
 * Exit 0 when every declared field is there; 1 with one line per mismatch otherwise.
 */

import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const mloop = process.argv[2] ?? 'mloop';
const { CONSUMED } = await import('../build/cli-fields.js');

/** Kinds of event a healthy run on this data may not print. */
const mayBeAbsent = new Set(['train#warning']);

const work = mkdtempSync(join(tmpdir(), 'mloop-mcp-output-'));
const problems = [];
const notes = [];

/** Runs the CLI in the project directory; its exit code is the caller's to judge (a failing run is the point of one of them). */
function run(args) {
  const result = spawnSync(mloop, args, { cwd: work, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 600_000 });
  if (result.error) {
    problems.push(`cannot run ${mloop} ${args.join(' ')}: ${result.error.message}`);
    return { stdout: '', stderr: '', status: null };
  }
  return { stdout: result.stdout, stderr: result.stderr, status: result.status };
}

/** One JSON object a line, the way `train --json` writes its events (a line that is not an object is not an event). */
function events(stdout) {
  const found = [];
  for (const line of stdout.split('\n')) {
    if (!line.startsWith('{')) continue;
    try {
      const value = JSON.parse(line);
      if (typeof value === 'object' && value !== null) found.push(value);
    } catch { /* not an event */ }
  }
  return found;
}

try {
  // A small table whose label follows x (with noise): enough for a search of two trials to finish.
  mkdirSync(join(work, 'datasets'), { recursive: true });
  let seed = 7;
  const next = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const rows = ['x,z,y'];
  for (let i = 0; i < 160; i++) {
    const x = next();
    rows.push(`${x.toFixed(4)},${next().toFixed(4)},${(next() < (x > 0.5 ? 0.9 : 0.1)) ? 'yes' : 'no'}`);
  }
  writeFileSync(join(work, 'datasets', 'train.csv'), rows.join('\n') + '\n');

  run(['init', '.', '--task', 'binary-classification']);
  const trained = run(['train', 'datasets/train.csv', '--label', 'y', '--time', '10', '--max-trials', '2', '--json']);
  const failed = run(['train', 'datasets/missing.csv', '--label', 'y', '--json']);
  const listed = run(['list', '--json']);

  const stream = [...events(trained.stdout), ...events(failed.stdout)];
  if (trained.status !== 0) problems.push(`the training run failed (exit ${trained.status}): ${trained.stderr.trim().split('\n').slice(-3).join(' | ')}`);

  // the stream itself: every line names its kind
  for (const field of CONSUMED.train) {
    const without = stream.filter(e => e[field] === undefined).length;
    if (stream.length === 0) problems.push(`train: the CLI printed no events (${trained.stdout.length} bytes on stdout)`);
    else if (without > 0) problems.push(`train: ${without} of ${stream.length} lines have no "${field}"`);
  }

  // each kind of event: the declared fields are in the events of that kind
  for (const [kind, fields] of Object.entries(CONSUMED)) {
    if (!kind.startsWith('train#')) continue;
    const name = kind.slice('train#'.length);
    const ofKind = stream.filter(e => e.event === name);
    if (ofKind.length === 0) {
      if (mayBeAbsent.has(kind)) notes.push(`${kind}: this run printed none — not judged`);
      else problems.push(`${kind}: the CLI printed no "${name}" event, so ${fields.map(f => `"${f}"`).join(', ')} could not be judged`);
      continue;
    }
    for (const field of fields) {
      if (!ofKind.some(e => e[field] !== undefined)) {
        const seen = [...new Set(ofKind.flatMap(e => Object.keys(e)))].sort().join(', ');
        problems.push(`${kind}: no "${name}" event has "${field}" (fields seen: ${seen})`);
      }
    }
  }

  // a single document
  let document = null;
  try { document = JSON.parse(listed.stdout); } catch { /* reported below */ }
  if (document === null || typeof document !== 'object') problems.push(`list: --json did not print a JSON object (exit ${listed.status})`);
  else for (const field of CONSUMED.list) if (document[field] === undefined) problems.push(`list: the answer has no "${field}" (fields seen: ${Object.keys(document).sort().join(', ')})`);
} finally {
  rmSync(work, { recursive: true, force: true });
}

for (const note of notes) console.log(`note: ${note}`);
if (problems.length > 0) {
  for (const problem of problems) console.error(problem);
  process.exit(1);
}
console.log(`ok — every field src/cli-fields.ts declares is in what ${mloop} printed`);

/**
 * Nothing this repository publishes carries a token that only means something inside the workspace it was
 * written in — an internal work-item or design-decision id, a path off one machine's disk, a pointer into a
 * private notes tree, the name of a private workspace repository or of a private data collection.
 *
 * This repository is public, and so is its package. A reader has no tracker to look an id up in and cannot follow
 * a link into a directory that exists only on a maintainer's machine; the token spends their attention and
 * returns nothing, and it leaks the shape of a private workspace. The rule is enforced by a pattern rather than
 * by careful reading, because careful reading misses tokens that look ordinary everywhere else. What the guard
 * does not do is decide what replaces a token it finds — that stays with the author. The names of projects that
 * consume this package are not listed here, deliberately: a list of them in a public file would be the leak it
 * guards against; those stay with review.
 *
 * The same shapes are enforced, in C#, by the sibling repositories' `InternalTokenContractTests`.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const here = relative(root, fileURLToPath(import.meta.url)).split('\\').join('/');

/** The file kinds whose text this package publishes: documents, sources, and the build and script files around them. */
const PUBLISHED = ['*.md', '*.ts', '*.mjs', '*.js', '*.json', '*.yml', '*.yaml', '*.sh', '*.ps1', '.gitignore'];
/** Machine-written or vendored text that no one edits and that carries third-party ids. */
const SKIPPED = ['package-lock.json'];

/** Prefixes that look like an internal id but are public vocabulary: encodings, standards bodies, hash names, a count. */
const PUBLIC_PREFIXES = new Set(['UTF', 'ISO', 'CP', 'CVE', 'RFC', 'ADR', 'SHA', 'N', 'NET']);

/** An internal id: a short upper-case prefix (or the literal `cycle`) and a number. Upper-case is the whole discrimination. */
const WORK_ITEM_ID = /\b(?<prefix>[A-Z]{1,5}|cycle)-\d+\b/g;
/** Internal units of work whose name is an ordinary word: a development cycle, a sprint. */
const INTERNAL_WORK_UNIT = /\b(?:[Cc]ycle|[Ss]print)[- ]\d+\b/g;
/** An absolute path on someone's machine, any drive letter. Prose only — in source it can be the input a test is about. */
const DRIVE_LETTER_PATH = /\b[A-Za-z]:\\/g;
/** Names of the private working tree this package is developed in. */
const PRIVATE_WORKSPACE_REF = /\b(claudedocs|HANDOFF|dev-docs)\b/g;
/** The private workspace repository, named the way such repositories are named, or the phrases that point at it. */
const PRIVATE_REPO_REF = /\b[A-Za-z0-9]+-umbrella\b|\bumbrella (?:policy|repo(?:sitory)?|CLAUDE)\b/g;
/** A sequence number of a private data collection ("SEQ020"). */
const DATASET_SEQUENCE_ID = /\bSEQ\d{3}\b/g;

function* tokensIn(line, isProse) {
  for (const m of line.matchAll(WORK_ITEM_ID)) {
    if (!PUBLIC_PREFIXES.has(m.groups.prefix)) yield m[0];
  }
  if (isProse) {
    for (const m of line.matchAll(DRIVE_LETTER_PATH)) yield `${m[0]}…  (absolute path on one machine)`;
  }
  for (const m of line.matchAll(INTERNAL_WORK_UNIT)) yield `${m[0]}  (internal unit of work)`;
  for (const m of line.matchAll(PRIVATE_WORKSPACE_REF)) yield `${m[0]}  (private working tree)`;
  for (const m of line.matchAll(PRIVATE_REPO_REF)) yield `${m[0]}  (private workspace repository)`;
  for (const m of line.matchAll(DATASET_SEQUENCE_ID)) yield `${m[0]}  (private data collection id)`;
}

/**
 * The tokens one line of a published file carries. An ignore file's pattern lines name paths — keeping a private
 * working tree out of a clone is what such a line is for — so only its comments are read as prose.
 */
function tokensInFileLine(path, line, isProse) {
  if (path.endsWith('.gitignore') && !line.trimStart().startsWith('#')) return [];
  return [...tokensIn(line, isProse)];
}

/** Every published file git knows about, tracked or not yet added — a guard that saw only tracked files would exempt the file just written. */
function publishedFiles() {
  const out = execFileSync('git', ['-C', root, 'ls-files', '--cached', '--others', '--exclude-standard', '--', ...PUBLISHED], {
    encoding: 'utf8',
  });
  return out
    .split('\n')
    .filter((f) => f.length > 0 && !SKIPPED.includes(f) && f !== here && existsSync(join(root, f)));
}

test('the scan reaches the documents, the sources and the ignore file', () => {
  const files = publishedFiles();
  assert.ok(files.some((f) => f.endsWith('.md')), 'no document reached');
  assert.ok(files.some((f) => f.startsWith('src/') && f.endsWith('.ts')), 'no source reached');
  assert.ok(files.includes('.gitignore'), 'the ignore file is not reached');
  assert.ok(!files.some((f) => f.startsWith('node_modules/') || f.startsWith('build/')), 'ignored state is being scanned');
});

test('published text carries no internal token', () => {
  const findings = [];
  for (const file of publishedFiles()) {
    const isProse = file.endsWith('.md');
    const lines = readFileSync(join(root, file), 'utf8').split(/\r?\n/);
    lines.forEach((line, i) => {
      for (const token of tokensInFileLine(file, line, isProse)) findings.push(`${file}:${i + 1}  ${token}`);
    });
  }
  assert.equal(
    findings.length,
    0,
    'Published text may not carry tokens that only mean something inside the private workspace. Delete a bare ' +
      'cross-reference; replace a marker that ties call sites together with a phrase that says what the tie is; ' +
      'rewrite a machine path as a placeholder.\n' + findings.join('\n'),
  );
});

// The guard can still see: each shape it forbids is fed a line containing one, and each near-miss it must tolerate a
// line containing that. A pattern that matches nothing passes in exactly the voice of a clean tree.
const CASES = [
  ['.md', 'settled as D-18 in review', true, 'design-decision id'],
  ['.md', 'see BUG-48 for the shape', true, 'work-item id with a longer prefix'],
  ['.md', 'fixed in cycle-93', true, 'cycle id'],
  ['.md', 'found in the sweep (Cycle 82)', true, 'cycle written as a word and a number'],
  ['.md', 'found during sprint-35', true, 'sprint id'],
  ['.md', 'open D:\\data\\project', true, 'absolute path on one machine'],
  ['.md', 'tracked in claudedocs/plans', true, 'private working tree'],
  ['.md', 'the design is in dev-docs/mloop', true, 'private design tree'],
  ['.md', 'the next step is in HANDOFF', true, 'private working tree'],
  ['.md', 'kept in the mloop-umbrella repo', true, 'private workspace repository name'],
  ['.md', 'see the umbrella policy for the cadence', true, 'pointer at the private workspace policy'],
  ['.md', 'seen on SEQ020 at 50K rows', true, 'private data collection id'],
  ['.md', 'see CVE-2024-1234 and RFC-4180', false, 'public identifiers'],
  ['.md', 'the SHA-256 of the file', false, 'a hash algorithm name'],
  ['.md', 're-encoded as UTF-8', false, 'an encoding'],
  ['.md', '[![.NET](https://img.shields.io/badge/.NET-10.0-512BD4)]', false, 'a platform badge'],
  ['.md', 'an umbrella package that pulls the others in', false, 'the ordinary word'],
  ['.md', 'a SEQUENCE of 12 steps', false, 'an ordinary word that starts with the letters'],
  ['.md', 'a two-tier router, run-1 and t-1', false, 'lower-case fixture data and a hyphenated word'],
  ['.gitignore', 'claudedocs/', false, 'an ignore pattern that keeps a private tree out of a clone'],
  ['.gitignore', '# the notes live in the mloop-umbrella repo', true, "an ignore file's comment is prose"],
  ['docs/guide.md', 'claudedocs/', true, 'the same text in a document'],
];

for (const [path, line, isInternal, what] of CASES) {
  test(`guard ${isInternal ? 'sees' : 'tolerates'} ${what}`, () => {
    const found = tokensInFileLine(path, line, path.endsWith('.md'));
    assert.equal(found.length > 0, isInternal, `${what}: "${line}" in ${path} -> ${found.length ? found.join(', ') : 'nothing'}`);
  });
}

#!/usr/bin/env node
/**
 * Checks that every tool passes the CLI only options the CLI has.
 *
 * Each tool is called with its schema filled in — every enum value in turn, every optional field set —
 * against a recording stand-in for `mloop` (MLOOP_PATH). Each recorded command line is then compared with
 * the real CLI's `--help` for that command: an option the command does not list, or a positional argument
 * passed to a command that takes none, is reported. A tool can only fail at the CLI it drives, so the CLI
 * is the authority — not this repository's idea of it.
 *
 * Usage: npm run build && node scripts/check-cli-options.mjs [path-to-mloop]   (default: mloop on PATH)
 * A command that has --json is also reported when a tool calls it without: its JSON is the machine answer, and the
 * console text a tool would pass on instead is a table an agent has to scrape.
 *
 * The other way round: every command the CLI lists, and every option each declares, is passed by some tool — or is in
 * `notExposed` with the reason it is left out. A tool that loses an option (a refactor drops `epochs`) fails here, which the
 * check above cannot see: it only reads what the tools do pass. A tool none of whose calls reaches the CLI is reported too.
 * Each tool is called with its fields set in turn — all, none, each alone, each pair, each boolean off — since a tool
 * that takes one of two alternatives refuses the call that sets both, and a refused call checks nothing.
 *
 * Exit 0 when every call fits; 1 with one line per mismatch otherwise.
 */

import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const realMloop = process.argv[2] ?? 'mloop';
const work = mkdtempSync(join(tmpdir(), 'mloop-mcp-check-'));
const log = join(work, 'calls.jsonl');

// The stand-in records its arguments and prints an empty JSON document, so a tool parsing --json output proceeds.
const recorder = join(work, 'mloop');
writeFileSync(recorder, `#!/usr/bin/env node
require('fs').appendFileSync(${JSON.stringify(log)}, JSON.stringify(process.argv.slice(2)) + '\\n');
process.stdout.write('{}');
`);
chmodSync(recorder, 0o755);
process.env.MLOOP_PATH = recorder;

const tools = await import('../build/tools/index.js');

/** The schema node beneath optional / default / nullable wrappers. */
function unwrap(node) {
  while (['optional', 'default', 'nullable'].includes(node._def.type)) node = node._def.innerType;
  return node;
}

/** A value of the field's type, or the enum's values. */
function samples(name, node, flip = false) {
  const inner = unwrap(node);
  switch (inner._def.type) {
    case 'enum': return inner.options;
    case 'number': return [1];
    case 'boolean': return flip ? [false] : [true];
    case 'array': return [['x']];
    case 'string': return [name === 'projectPath' ? work : 'x'];
    default: return [];
  }
}

const isOptional = (node) => ['optional', 'default', 'nullable'].includes(node._def.type);

/**
 * The parameter sets a tool is called with. Setting every field at once is not enough: a tool that takes one of
 * `experimentId` / `latest` / `best`, or images or texts, refuses that call before it reaches the CLI — so the call the
 * CLI would have judged is never made, and the tool looks clean because it was never looked at. So also: only the
 * required fields, each optional field alone, and each pair of optional fields (an option that needs a selector beside
 * it is reached through a pair). Every combination of the enum fields in each case.
 */
function variants(schema) {
  const fields = Object.entries(schema.shape);
  const optional = fields.filter(([, node]) => isOptional(node)).map(([name]) => name);
  const rowsWith = ([set, off]) => {
    let rows = [{}];
    for (const [name, node] of fields) {
      if (isOptional(node) && !set.has(name)) continue;
      const values = samples(name, node, name === off);
      if (values.length === 0) continue;
      rows = rows.flatMap(row => values.map(v => ({ ...row, [name]: v })));
    }
    return rows;
  };
  const sets = [[new Set(optional)], [new Set()], ...optional.map(a => [new Set([a])])];
  for (let a = 0; a < optional.length; a++)
    for (let b = a + 1; b < optional.length; b++) sets.push([new Set([optional[a], optional[b]])]);
  // a boolean that is on by default is passed to turn it off: each boolean off, alone
  for (const [name, node] of fields)
    if (isOptional(node) && unwrap(node)._def.type === 'boolean') sets.push([new Set([name]), name]);
  return sets.flatMap(rowsWith);
}

const helpCache = new Map();
/** The options and whether positional arguments are taken, for a command path, from the real CLI's --help. */
function help(path) {
  const key = path.join(' ');
  if (!helpCache.has(key)) {
    let text = '';
    try {
      text = execFileSync(realMloop, [...path, '--help'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (e) {
      text = (e.stdout ?? '') + (e.stderr ?? '');
      if (e.code === 'ENOENT') text = '';
    }
    // A guard that cannot read the CLI must say so, not report every option as unknown: without a
    // `mloop` on PATH this used to print one "mismatch" per option — 226 of them — instead of the cause.
    if (!/^Usage:/m.test(text)) {
      console.error(`Cannot read the help of \`mloop ${key}\` from '${realMloop}'. Pass the CLI to check against: `
        + 'node scripts/check-cli-options.mjs <path-to-mloop>.');
      process.exit(2);
    }
    const options = new Set([...text.matchAll(/(?:^|[\s,])(--[a-z][a-z0-9-]*)/gm)].map(m => m[1]));
    const subcommands = new Set();
    const section = text.split(/\n(?=\S)/).find(s => /^Commands:/.test(s)) ?? '';
    for (const m of section.matchAll(/^\s{2}(\S+)/gm)) subcommands.add(m[1].split(/[\s,]/)[0]);
    helpCache.set(key, { options, subcommands, positional: /^Arguments:/m.test(text), text });
  }
  return helpCache.get(key);
}

/**
 * Calls that leave out --json on purpose, each with its reason: `predict --output` writes the CSV file, which --json
 * replaces with JSON on stdout.
 */
const withoutJsonByDesign = [
  { path: 'predict', when: (args) => args.includes('--output') || args.includes('-o') },
];

const failures = [];
let calls = 0;
/** The options the tools passed, per command path ("train", "logs prune"): what the tools can drive. */
const passed = new Map();
/** Recorded CLI calls per tool: a tool with none was never looked at. */
const callsByTool = new Map();
for (const [exportName, tool] of Object.entries(tools)) {
  if (!exportName.endsWith('Tool') || typeof tool?.handler !== 'function') continue;
  const schema = tools[exportName.replace(/Tool$/, 'Schema')];
  if (!schema?.shape) continue;
  if (!callsByTool.has(tool.name)) callsByTool.set(tool.name, 0);

  for (const params of variants(schema)) {
    writeFileSync(log, '');
    try { await tool.handler(params); } catch { /* a refusal before the CLI is not this check's concern */ }
    const lines = existsSync(log) ? readFileSync(log, 'utf8').split('\n').filter(Boolean) : [];
    callsByTool.set(tool.name, (callsByTool.get(tool.name) ?? 0) + lines.length);
    for (const line of lines) {
      calls++;
      const args = JSON.parse(line);
      notePassed(args);
      failures.push(...mismatches(args, tool.name, params));
    }
  }
}

/** The command a recorded line runs and where its arguments start: the leading words the CLI knows as (sub)commands. */
function commandOf(args) {
  const path = [args[0]];
  let i = 1;
  while (i < args.length && !args[i].startsWith('-') && help(path).subcommands.has(args[i])) path.push(args[i++]);
  return { path, i };
}

function notePassed(args) {
  const { path, i } = commandOf(args);
  const key = path.join(' ');
  if (!passed.has(key)) passed.set(key, new Set());
  for (const arg of args.slice(i)) if (arg.startsWith('--')) passed.get(key).add(arg);
}

/**
 * The task types the CLI lists, from `mloop init --help` ("-t, --task <task>  ML task type (a, b, c) [default: …]").
 * Read the other way round from the option check above: that one finds a tool passing what the CLI lacks; this one finds
 * a tool that cannot say what the CLI can.
 */
function cliTasks() {
  const text = help(['init']).text;
  const list = /--task <task>\s+ML task type \(([^)]*)\)/.exec(text)?.[1];
  if (!list) {
    console.error('Cannot read the task list from `mloop init --help`.');
    process.exit(2);
  }
  return list.split(',').map(t => t.trim()).filter(Boolean);
}

/** How a tool's `task` values differ from the CLI's list, or nothing when they are the same set. */
function taskDifference(toolName, values, cli) {
  const missing = cli.filter(t => !values.includes(t));
  const extra = values.filter(t => !cli.includes(t));
  return [
    ...(missing.length ? [`${toolName}: \`task\` lacks the CLI's ${missing.join(', ')}`] : []),
    ...(extra.length ? [`${toolName}: \`task\` lists ${extra.join(', ')}, which the CLI does not know`] : []),
  ];
}

for (const [exportName, tool] of Object.entries(tools)) {
  if (!exportName.endsWith('Tool')) continue;
  const task = tools[exportName.replace(/Tool$/, 'Schema')]?.shape?.task;
  if (task && unwrap(task)._def.type === 'enum') failures.push(...taskDifference(tool.name, unwrap(task).options, cliTasks()));
}

/**
 * What the CLI has that no tool can say, each with the reason it is left out. `option` absent = the whole command.
 * An entry is checked as well: one the CLI no longer has, or a tool now drives, is reported as stale — a list that
 * only grows would stop meaning anything.
 */
const notExposed = [
  { command: 'init', option: '--force', why: 'rebuilds .mloop/ of an existing project — the person decides to reinitialize, not an agent retrying' },
  { command: 'promote', option: '--no-backup', why: 'skips the backup of the production model that mloop_rollback returns to' },
  { command: 'serve', option: '--detach', why: 'mloop_serve detaches the server itself and answers once /health does (src/tools/serve.ts)' },
  { command: 'preprocess', why: 'runs the project\'s own compiled scripts — code the person chose to run, not a data step' },
  { command: 'logs prune', why: 'deletes logs and feedback by age; `mloop serve` runs it daily, and a delete is the person\'s call' },
  { command: 'new hook', why: 'writes a script into the project to be compiled and run — authoring code, not operating the project' },
  { command: 'update', why: 'replaces the running CLI binary — never from inside a tool call' },
];

/**
 * The options a command declares in its own `Options:` section — not the words `--like-this` in a description. One entry
 * per option line, holding every long name it goes by (`--rows, --size <rows>` is one option): passing either counts.
 */
function declaredOptions(path) {
  const section = help(path).text.split(/\n(?=\S)/).find(s => /^Options:/.test(s)) ?? '';
  const found = [];
  for (const m of section.matchAll(/^\s{2}((?:-[^\s,]+(?:,\s*)?)+)/gm)) {
    const names = [...m[1].matchAll(/--[a-z][a-z0-9-]*/g)].map(n => n[0]).filter(n => n !== '--help' && n !== '--version');
    if (names.length > 0) found.push(names);
  }
  return found;
}

/** Every command the CLI lists, by path ("train", "logs prune"); the root is not one. */
function cliCommands() {
  const all = [];
  const walk = (path) => {
    for (const sub of help(path).subcommands) {
      all.push([...path, sub]);
      walk([...path, sub]);
    }
  };
  walk([]);
  return all;
}

/**
 * Read the other way round from the option check: that finds a tool passing what the CLI lacks; this finds a CLI command
 * or option no tool can pass. A command with subcommands is judged by those (and by itself only when a tool runs it).
 */
function unexposed(commands, passedByCommand, allowed) {
  const found = [];
  const allows = (command, option) => allowed.some(e => e.command === command && e.option === option);
  for (const path of commands) {
    const key = path.join(' ');
    const driven = passedByCommand.get(key);
    if (!driven) {
      if (help(path).subcommands.size === 0 && !allows(key, undefined))
        found.push(`CLI \`mloop ${key}\` is driven by no tool`);
      continue;
    }
    for (const names of declaredOptions(path))
      if (!names.some(n => driven.has(n)) && !names.some(n => allows(key, n)))
        found.push(`CLI \`mloop ${key}\` has ${names.join(', ')}, which no tool passes`);
  }
  for (const e of allowed) {
    const path = commands.find(p => p.join(' ') === e.command);
    const driven = passedByCommand.get(e.command);
    if (!path) found.push(`not-exposed list: \`mloop ${e.command}\` is not a CLI command any more`);
    else if (e.option === undefined && driven) found.push(`not-exposed list: \`mloop ${e.command}\` is driven by a tool now`);
    else if (e.option !== undefined && !declaredOptions(path).some(names => names.includes(e.option)))
      found.push(`not-exposed list: \`mloop ${e.command}\` has no ${e.option} any more`);
    else if (e.option !== undefined && driven?.has(e.option))
      found.push(`not-exposed list: ${e.option} of \`mloop ${e.command}\` is passed by a tool now`);
  }
  return found;
}

failures.push(...unexposed(cliCommands(), passed, notExposed));

/** The tools none of whose parameter sets reached the CLI — every one was refused first, so nothing about them was checked. */
function toolsNeverCalled(callsPerTool) {
  return [...callsPerTool].filter(([, n]) => n === 0).map(([name]) => `${name}: no parameter set reached the CLI — the tool was not checked`);
}
failures.push(...toolsNeverCalled(callsByTool));

/** The ways one recorded command line does not fit the CLI. */
function mismatches(args, toolName, params) {
  const found = [];
  const { path, i: argsFrom } = commandOf(args);
  let i = argsFrom;
  const { options, positional } = help(path);
  if (options.has('--json') && !args.includes('--json')
      && !withoutJsonByDesign.some(e => e.path === path.join(' ') && e.when(args)))
    found.push(`${toolName}: \`mloop ${path.join(' ')}\` has --json and the tool reads its console text  (${JSON.stringify(params)})`);
  for (; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      if (!options.has(arg)) found.push(`${toolName}: \`mloop ${path.join(' ')}\` has no ${arg}  (${JSON.stringify(params)})`);
      if (i + 1 < args.length && !args[i + 1].startsWith('-')) i++;   // its value, known option or not
    } else if (!positional) {
      found.push(`${toolName}: \`mloop ${path.join(' ')}\` takes no argument '${arg}'  (${JSON.stringify(params)})`);
    }
  }
  return found;
}

// The check must be able to see what it forbids: a command line with an option the CLI lacks, and a positional
// argument to a command that takes none, are both reported — or the check is blind and says so.
const blind = [['logs', '--no-such-option', 'x', '--json'], ['status', 'stray', '--json'], ['status']]
  .filter(args => mismatches(args, 'self-check', {}).length === 0);
if (blind.length > 0) {
  console.error(`The check did not see a known mismatch: ${blind.map(a => 'mloop ' + a.join(' ')).join('; ')}`);
  process.exit(1);
}

// ...and a task list missing one of the CLI's, or naming one it lacks, is reported.
if (taskDifference('self-check', ['regression'], ['regression', 'clustering']).length !== 1
    || taskDifference('self-check', ['regression', 'nope'], ['regression']).length !== 1) {
  console.error('The check did not see a known task-list mismatch.');
  process.exit(1);
}

// ...and so is a CLI command or option no tool drives (and a stale entry of the list that excuses one): `status` is a
// command with options, so an empty passed set must report each of them, a complete one none, and the list's checks both
// ways. If `status` declared no option, this could not tell a working check from a blind one.
const statusOptions = declaredOptions(['status']).map(names => names[0]);
const status = [['status']];
if (statusOptions.length === 0
    || unexposed(status, new Map([['status', new Set()]]), []).length !== statusOptions.length
    || unexposed(status, new Map([['status', new Set(statusOptions)]]), []).length !== 0
    || unexposed(status, new Map(), []).length !== 1
    || unexposed(status, new Map([['status', new Set(statusOptions)]]), [{ command: 'status', option: '--no-such-option', why: 'x' }]).length !== 1
    || unexposed(status, new Map([['status', new Set()]]), statusOptions.map(option => ({ command: 'status', option, why: 'x' }))).length !== 0) {
  console.error('The check did not see a known unexposed option or a stale not-exposed entry.');
  process.exit(1);
}

// ...and a tool every call of which is refused before the CLI is reported, not passed over.
if (toolsNeverCalled(new Map([['silent', 0], ['called', 3]])).length !== 1) {
  console.error('The check did not see a tool that never reached the CLI.');
  process.exit(1);
}

if (calls === 0) {
  // A check that ran nothing would report a clean bill it never earned.
  console.error('No tool call reached the CLI stand-in — the check saw nothing.');
  process.exit(1);
}
for (const f of [...new Set(failures)]) console.log(f);
console.error(`${calls} CLI calls checked, ${new Set(failures).size} mismatch(es).`);
process.exit(failures.length ? 1 : 0);

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
function samples(name, node) {
  const inner = unwrap(node);
  switch (inner._def.type) {
    case 'enum': return inner.options;
    case 'number': return [1];
    case 'boolean': return [true];
    case 'array': return [['x']];
    case 'string': return [name === 'projectPath' ? work : 'x'];
    default: return [];
  }
}

/** Every combination of the enum fields, with every other field set to its sample. */
function variants(schema) {
  let rows = [{}];
  for (const [name, node] of Object.entries(schema.shape)) {
    const values = samples(name, node);
    if (values.length === 0) continue;
    rows = rows.flatMap(row => values.map(v => ({ ...row, [name]: v })));
  }
  return rows;
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
    }
    const options = new Set([...text.matchAll(/(?:^|[\s,])(--[a-z][a-z0-9-]*)/gm)].map(m => m[1]));
    const subcommands = new Set();
    const section = text.split(/\n(?=\S)/).find(s => /^Commands:/.test(s)) ?? '';
    for (const m of section.matchAll(/^\s{2}(\S+)/gm)) subcommands.add(m[1].split(/[\s,]/)[0]);
    helpCache.set(key, { options, subcommands, positional: /^Arguments:/m.test(text) });
  }
  return helpCache.get(key);
}

const failures = [];
let calls = 0;
for (const [exportName, tool] of Object.entries(tools)) {
  if (!exportName.endsWith('Tool') || typeof tool?.handler !== 'function') continue;
  const schema = tools[exportName.replace(/Tool$/, 'Schema')];
  if (!schema?.shape) continue;

  for (const params of variants(schema)) {
    writeFileSync(log, '');
    try { await tool.handler(params); } catch { /* a refusal before the CLI is not this check's concern */ }
    const lines = existsSync(log) ? readFileSync(log, 'utf8').split('\n').filter(Boolean) : [];
    for (const line of lines) {
      calls++;
      failures.push(...mismatches(JSON.parse(line), tool.name, params));
    }
  }
}

/** The ways one recorded command line does not fit the CLI. */
function mismatches(args, toolName, params) {
  const found = [];
  // The command path is the leading words the CLI knows as (sub)commands.
  const path = [args[0]];
  let i = 1;
  while (i < args.length && !args[i].startsWith('-') && help(path).subcommands.has(args[i])) path.push(args[i++]);
  const { options, positional } = help(path);
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
const blind = [['logs', '--no-such-option', 'x'], ['status', 'stray']]
  .filter(args => mismatches(args, 'self-check', {}).length === 0);
if (blind.length > 0) {
  console.error(`The check did not see a known mismatch: ${blind.map(a => 'mloop ' + a.join(' ')).join('; ')}`);
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

/**
 * Runs `mloop train --json` for a tool call: its events become the call's progress notifications, cancelling the call
 * stops the run, and the answer is the run's own result rather than its console text.
 */

import type { ServerContext } from '@modelcontextprotocol/server';
import { executeMloop } from './executor.js';
import { CliExecutionError, formatError } from './utils/errors.js';

/** One line of `mloop train --json`: phase · trial · warning · result · error. */
interface TrainEvent {
  event: string;
  [key: string]: unknown;
}

/**
 * What a finished run answers: the `result` event, the `promotion` event (whether it went to production, and why not),
 * and the warnings it raised on the way. `promotion` is null from a CLI older than the event.
 */
export interface TrainingOutcome {
  result: TrainEvent | null;
  promotion: TrainEvent | null;
  warnings: string[];
}

/** How often trial progress is sent at most — a search can finish dozens of trials a second. */
const PROGRESS_INTERVAL_MS = 1_000;

/**
 * The wall-clock bound of a run with a time budget: the budget plus room for loading, evaluation and saving. A run
 * without one sizes its own budget from the data, so it has no wall-clock bound — only the idle one.
 */
export function trainingTimeout(timeSeconds: number | undefined): number | null {
  return timeSeconds === undefined ? null : timeSeconds * 1000 + Math.max(600_000, timeSeconds * 500);
}

/**
 * Runs `args` (a `train` command line without `--json`) in `cwd`. Progress is sent only when the caller asked for it
 * with a progress token. Its value counts the notifications — the protocol wants it to rise with every one, which
 * elapsed time rounded to a readable step does not, and a run's end is not known ahead of it (a budget is not a
 * deadline: loading, evaluation and saving come after) — and its message says what happened and the time so far.
 */
export async function runTraining(
  args: string[],
  cwd: string,
  timeSeconds: number | undefined,
  ctx?: ServerContext,
): Promise<TrainingOutcome> {
  const token = ctx?.mcpReq._meta?.progressToken;
  const started = Date.now();
  let lastSent = 0;
  let sent = 0;
  let trials = 0;
  const warnings: string[] = [];
  let result: TrainEvent | null = null;
  let promotion: TrainEvent | null = null;

  const progress = (message: string, force: boolean) => {
    if (token === undefined || ctx === undefined) return;
    const now = Date.now();
    if (!force && now - lastSent < PROGRESS_INTERVAL_MS) return;
    lastSent = now;
    void ctx.mcpReq.notify({
      method: 'notifications/progress',
      params: {
        progressToken: token,
        progress: ++sent,
        message: `${message} · ${elapsed(now - started)}${timeSeconds !== undefined ? ` of a ${timeSeconds} s budget` : ''}`,
      },
    }).catch(() => undefined);
  };

  const onLine = (line: string) => {
    const event = parse(line);
    if (!event) return;
    switch (event.event) {
      case 'phase':
        progress(`phase ${String(event['phase'])}`, true);
        break;
      case 'trial': {
        trials++;
        // Which score is best is the CLI's judgment (a metric's direction); the line reports this trial's.
        const value = typeof event['value'] === 'number' ? ` ${String(event['metric'])} ${event['value'].toFixed(4)}` : '';
        progress(`trial ${trials}: ${String(event['trainer'] ?? '').replace(/ \(.*$/, '')}${value}`, false);
        break;
      }
      case 'warning':
        warnings.push(String(event['message'] ?? ''));
        break;
      case 'result':
        result = event;
        break;
      case 'promotion':
        promotion = event;
        break;
    }
  };

  try {
    await executeMloop([...args, '--json'], {
      cwd,
      timeout: trainingTimeout(timeSeconds),
      onStdoutLine: onLine,
    });
  } catch (error) {
    // The run says why it failed as error events; the console text on stderr repeats them for a person.
    if (error instanceof CliExecutionError) {
      const reasons = error.stdout.split('\n').map(parse)
        .filter((e): e is TrainEvent => e?.event === 'error')
        .map(e => String(e['message'] ?? ''));
      if (reasons.length > 0) throw new Error(reasons.join('\n'));
    }
    throw new Error(formatError(error));
  }
  return { result, promotion, warnings };
}

function parse(line: string): TrainEvent | null {
  if (!line.startsWith('{')) return null;
  try {
    const value = JSON.parse(line) as unknown;
    return typeof value === 'object' && value !== null && 'event' in value ? value as TrainEvent : null;
  } catch {
    return null;
  }
}

function elapsed(ms: number): string {
  return `${(ms / 1000).toFixed(1)} s`;
}

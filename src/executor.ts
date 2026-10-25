/**
 * CLI subprocess executor for mloop commands
 */

import { spawn, type ChildProcess } from 'child_process';
import { AsyncLocalStorage } from 'node:async_hooks';
import { openSync, closeSync } from 'node:fs';
import { CancelledError, CliExecutionError, TimeoutError } from './utils/errors.js';

export interface ExecuteOptions {
  /** Working directory for command execution */
  cwd?: string;
  /**
   * Wall-clock bound in milliseconds; none by default — how long a command takes follows its data, and the caller
   * can cancel (see `signal`).
   */
  timeout?: number | null;
  /**
   * Stops the command when it has written nothing for this long, in milliseconds (default 20 minutes) — what tells a
   * stalled command from a long one.
   */
  idleTimeout?: number;
  /** Stops the command when aborted; defaults to the signal of the tool call being answered ({@link withRequestSignal}). */
  signal?: AbortSignal;
  /** Called with each complete line the command writes to stdout, as it arrives. */
  onStdoutLine?: (line: string) => void;
  /** Environment variables to pass */
  env?: Record<string, string>;
}

export interface ExecuteResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

const DEFAULT_IDLE_TIMEOUT = 20 * 60_000;

const requestSignal = new AsyncLocalStorage<AbortSignal>();

/**
 * Runs `work` with `signal` as the cancellation of every command it executes — the server wraps each tool call in the
 * call's own signal, so cancelling a call stops the command it is waiting on, whichever tool runs it.
 */
export function withRequestSignal<T>(signal: AbortSignal, work: () => Promise<T>): Promise<T> {
  return requestSignal.run(signal, work);
}

/**
 * Get the mloop executable path.
 * Uses MLOOP_PATH environment variable if set, otherwise defaults to 'mloop'.
 */
function getMloopPath(): string {
  return process.env['MLOOP_PATH'] || 'mloop';
}

/**
 * Execute mloop CLI command
 *
 * @param args - Arguments to pass to mloop command
 * @param options - Execution options
 * @returns Promise resolving to execution result
 * @throws CliExecutionError if command fails
 * @throws TimeoutError if command times out
 */
export async function executeMloop(
  args: string[],
  options: ExecuteOptions = {}
): Promise<ExecuteResult> {
  const { cwd, timeout = null, idleTimeout = DEFAULT_IDLE_TIMEOUT, onStdoutLine, env } = options;
  const signal = options.signal ?? requestSignal.getStore();

  if (signal?.aborted) throw new CancelledError();

  return new Promise((resolve, reject) => {
    const proc = spawnMloop(args, cwd, env, ['pipe', 'pipe', 'pipe']);

    let stdout = '';
    let stderr = '';
    let pending = '';
    let killed = false;

    const stop = (error: Error) => {
      if (killed) return;
      killed = true;
      clearTimers();
      killTree(proc.pid);
      reject(error);
    };

    const timeoutId = timeout == null
      ? undefined
      : setTimeout(() => stop(new TimeoutError(`Command timed out after ${timeout}ms`, timeout)), timeout);
    let idleId: ReturnType<typeof setTimeout> | undefined;
    const touch = () => {
      if (idleTimeout === undefined) return;
      clearTimeout(idleId);
      idleId = setTimeout(
        () => stop(new TimeoutError(`Command wrote nothing for ${idleTimeout}ms`, idleTimeout)), idleTimeout);
    };
    const onAbort = () => stop(new CancelledError());
    const clearTimers = () => {
      clearTimeout(timeoutId);
      clearTimeout(idleId);
      signal?.removeEventListener('abort', onAbort);
    };
    signal?.addEventListener('abort', onAbort, { once: true });
    touch();

    proc.stdout?.on('data', (data: Buffer) => {
      const text = data.toString();
      stdout += text;
      touch();
      if (!onStdoutLine) return;
      pending += text;
      const lines = pending.split('\n');
      pending = lines.pop() ?? '';
      for (const line of lines) onStdoutLine(line.replace(/\r$/, ''));
    });

    proc.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString();
      touch();
    });

    proc.on('error', (error: Error) => {
      clearTimers();
      reject(new CliExecutionError(
        `Failed to execute mloop: ${error.message}`,
        -1,
        stdout,
        stderr
      ));
    });

    proc.on('close', (code: number | null) => {
      clearTimers();

      if (killed) return; // Already rejected: timed out, idle or cancelled
      if (onStdoutLine && pending) onStdoutLine(pending.replace(/\r$/, ''));

      const exitCode = code ?? 0;
      const result: ExecuteResult = { stdout, stderr, exitCode };

      if (exitCode !== 0) {
        reject(new CliExecutionError(
          `mloop exited with code ${exitCode}`,
          exitCode,
          stdout,
          stderr
        ));
      } else {
        resolve(result);
      }
    });
  });
}

/**
 * Starts mloop and leaves it running after this server returns — `mloop serve`. Its output goes to `logFile`; the
 * caller watches the returned process only for an early exit.
 */
export function startMloopDetached(args: string[], cwd: string | undefined, logFile: string): ChildProcess {
  const log = openSync(logFile, 'a');
  try {
    const proc = spawnMloop(args, cwd, undefined, ['ignore', log, log]);
    proc.unref();
    return proc;
  } finally {
    closeSync(log);
  }
}

/** Stops a process started by {@link startMloopDetached} — and what it started. */
export function stopMloop(proc: ChildProcess): void {
  killTree(proc.pid);
}

function spawnMloop(
  args: string[],
  cwd: string | undefined,
  env: Record<string, string> | undefined,
  stdio: Array<'pipe' | 'ignore' | number>,
): ChildProcess {
  // Build single command string for shell execution
  // This avoids DEP0190 (passing args array with shell: true)
  const quotedArgs = args.map(arg =>
    arg.includes(' ') ? `"${arg}"` : arg
  );
  const command = `${getMloopPath()} ${quotedArgs.join(' ')}`;

  return spawn(command, [], {
    cwd,
    env: { ...process.env, ...env },
    shell: true, // Required for Windows PATH resolution
    windowsHide: true,
    stdio,
    // Its own process group, so stopping it stops mloop and not only the shell that started it.
    detached: process.platform !== 'win32',
  });
}

/** Stops a command started by {@link executeMloop} and whatever it started. */
function killTree(pid: number | undefined): void {
  if (pid === undefined) return;
  try {
    if (process.platform === 'win32') spawn('taskkill', ['/pid', String(pid), '/T', '/F'], { windowsHide: true });
    else process.kill(-pid, 'SIGTERM');
  } catch {
    // Already gone.
  }
}

/**
 * Build CLI arguments from a parameter object
 * Handles common patterns like --flag, --key=value
 */
export function buildArgs(
  command: string,
  params: Record<string, unknown>
): string[] {
  const args: string[] = [command];

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === false) {
      continue;
    }

    // Convert camelCase to kebab-case for CLI flags
    const flag = `--${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`;

    if (value === true) {
      args.push(flag);
    } else {
      args.push(flag, String(value));
    }
  }

  return args;
}

/**
 * Build CLI arguments for positional + named parameters
 */
export function buildArgsWithPositional(
  command: string,
  positional: string[],
  params: Record<string, unknown>
): string[] {
  const args: string[] = [command, ...positional];

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === false) {
      continue;
    }

    const flag = `--${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`;

    if (value === true) {
      args.push(flag);
    } else {
      args.push(flag, String(value));
    }
  }

  return args;
}

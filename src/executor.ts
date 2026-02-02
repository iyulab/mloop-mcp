/**
 * CLI subprocess executor for mloop commands
 */

import { spawn } from 'child_process';
import { CliExecutionError, TimeoutError } from './utils/errors.js';

export interface ExecuteOptions {
  /** Working directory for command execution */
  cwd?: string;
  /** Timeout in milliseconds (default: 300000 = 5 minutes) */
  timeout?: number;
  /** Environment variables to pass */
  env?: Record<string, string>;
}

export interface ExecuteResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

const DEFAULT_TIMEOUT = 300_000; // 5 minutes

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
  const { cwd, timeout = DEFAULT_TIMEOUT, env } = options;
  const mloopPath = getMloopPath();

  return new Promise((resolve, reject) => {
    const proc = spawn(mloopPath, args, {
      cwd,
      env: { ...process.env, ...env },
      shell: true, // Required for Windows
      windowsHide: true,
    });

    let stdout = '';
    let stderr = '';
    let killed = false;

    const timeoutId = setTimeout(() => {
      killed = true;
      proc.kill('SIGTERM');
      reject(new TimeoutError(`Command timed out after ${timeout}ms`, timeout));
    }, timeout);

    proc.stdout?.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    proc.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    proc.on('error', (error: Error) => {
      clearTimeout(timeoutId);
      reject(new CliExecutionError(
        `Failed to execute mloop: ${error.message}`,
        -1,
        stdout,
        stderr
      ));
    });

    proc.on('close', (code: number | null) => {
      clearTimeout(timeoutId);

      if (killed) return; // Already handled by timeout

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

/**
 * Error handling utilities for mloop-mcp
 */

/**
 * Remove ANSI escape codes from string
 */
export function stripAnsi(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
}

/**
 * Custom error for CLI execution failures
 */
export class CliExecutionError extends Error {
  constructor(
    message: string,
    public readonly exitCode: number,
    public readonly stdout: string,
    public readonly stderr: string
  ) {
    super(message);
    this.name = 'CliExecutionError';
  }
}

/**
 * Custom error for timeout
 */
export class TimeoutError extends Error {
  constructor(
    message: string,
    public readonly timeoutMs: number
  ) {
    super(message);
    this.name = 'TimeoutError';
  }
}

/**
 * Format error for MCP response
 */
export function formatError(error: unknown): string {
  if (error instanceof CliExecutionError) {
    const parts = [`CLI Error (exit code ${error.exitCode})`];

    if (error.stderr) {
      parts.push(`\nStderr: ${stripAnsi(error.stderr)}`);
    }
    if (error.stdout) {
      parts.push(`\nStdout: ${stripAnsi(error.stdout)}`);
    }

    return parts.join('');
  }

  if (error instanceof TimeoutError) {
    return `Timeout: Command did not complete within ${error.timeoutMs}ms`;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

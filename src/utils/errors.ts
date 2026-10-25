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
 * The request a command ran for was cancelled, and the command was stopped.
 */
export class CancelledError extends Error {
  constructor() {
    super('Cancelled: the request was cancelled and the command stopped');
    this.name = 'CancelledError';
  }
}

/**
 * Format error for MCP response
 */
export function formatError(error: unknown): string {
  if (error instanceof CliExecutionError) {
    // A command asked for --json that fails with a structured answer (validate's errors, a refused promotion) says
    // so on stdout as JSON; that answer is the result, the console text on stderr repeats it for a person.
    const answer = stripAnsi(error.stdout).trim();
    if (answer.startsWith('{') || answer.startsWith('[')) {
      try {
        JSON.parse(answer);
        return answer;
      } catch {
        // Not one JSON document — fall through to the full report.
      }
    }

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
    return `Timeout: ${error.message}`;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

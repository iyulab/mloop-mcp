/**
 * mloop_serve tool - Start REST API server
 */

import { z } from 'zod';
import { readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { startMloopDetached, stopMloop } from '../executor.js';
import { stripAnsi } from '../utils/errors.js';

export const serveSchema = z.object({
  projectPath: z.string().describe('Path to MLoop project directory'),
  port: z.number().optional().describe('Port number (default: 5000)'),
  host: z.string().optional().describe('Host to bind to'),
});

export type ServeParams = z.infer<typeof serveSchema>;

/** How long the server may take to answer `/health` — it loads and preloads models before it listens. */
const STARTUP_MS = 60_000;

export async function serve(params: ServeParams): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  const { projectPath, host } = params;
  const port = params.port ?? 5000;

  const args: string[] = ['serve', '--port', String(port)];
  if (host) args.push('--host', host);

  // The server outlives this call: it runs detached, its output in a log file the answer names.
  const logFile = join(tmpdir(), `mloop-serve-${port}-${Date.now()}.log`);
  const proc = startMloopDetached(args, projectPath, logFile);
  let exited: number | null | undefined;
  proc.on('exit', (code) => { exited = code; });

  const url = `http://${host && host !== '0.0.0.0' && host !== '*' && host !== '+' ? host : '127.0.0.1'}:${port}`;
  const deadline = Date.now() + STARTUP_MS;
  while (Date.now() < deadline) {
    if (exited !== undefined) {
      return answer(`mloop serve exited (code ${exited}) before answering ${url}/health.\n${tail(logFile)}`, true);
    }
    try {
      const response = await fetch(`${url}/health`, { signal: AbortSignal.timeout(2_000) });
      if (response.ok) {
        return answer(JSON.stringify({
          url,
          pid: proc.pid,
          log: logFile,
          stop: process.platform === 'win32' ? `taskkill /pid ${proc.pid} /T /F` : `kill -- -${proc.pid}`,
        }, null, 2), false);
      }
    } catch {
      // Not listening yet.
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  stopMloop(proc);
  return answer(`mloop serve did not answer ${url}/health within ${STARTUP_MS / 1000} s and was stopped.\n${tail(logFile)}`, true);
}

function answer(text: string, isError: boolean): { content: Array<{ type: 'text'; text: string }>; isError?: boolean } {
  return { content: [{ type: 'text', text }], ...(isError ? { isError } : {}) };
}

function tail(logFile: string): string {
  try {
    return stripAnsi(readFileSync(logFile, 'utf8')).trim().split('\n').slice(-20).join('\n');
  } catch {
    return '';
  }
}

export const serveTool = {
  name: 'mloop_serve',
  description: 'Start the MLoop REST API server for serving predictions via HTTP. Returns once the server answers /health, with its URL, process id, log file and the command that stops it; the server keeps running after the call.',
  handler: serve,
};

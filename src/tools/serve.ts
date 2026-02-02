/**
 * mloop_serve tool - Start REST API server
 */

import { z } from 'zod';
import { executeMloop } from '../executor.js';
import { parseCliOutput } from '../utils/parser.js';
import { formatError } from '../utils/errors.js';

export const serveSchema = z.object({
  projectPath: z.string().describe('Path to MLoop project directory'),
  port: z.number().optional().describe('Port number (default: 5000)'),
  host: z.string().optional().describe('Host to bind to'),
});

export type ServeParams = z.infer<typeof serveSchema>;

export async function serve(params: ServeParams): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  try {
    const { projectPath, port, host } = params;

    const args: string[] = ['serve'];
    if (port) {
      args.push('--port', String(port));
    }
    if (host) {
      args.push('--host', host);
    }

    // Note: serve is a long-running command, so we use a short timeout
    // and expect it to "fail" when it starts successfully
    const result = await executeMloop(args, {
      cwd: projectPath,
      timeout: 5000, // 5 seconds - just enough to start
    });

    const output = parseCliOutput(result.stdout);

    return {
      content: [{
        type: 'text',
        text: output || `API server starting on port ${port ?? 5000}...`,
      }],
    };
  } catch (error) {
    // If it's a timeout, the server likely started successfully
    if (error instanceof Error && error.name === 'TimeoutError') {
      return {
        content: [{
          type: 'text',
          text: `API server started on port ${params.port ?? 5000}. The server is running in the background.`,
        }],
      };
    }

    return {
      content: [{
        type: 'text',
        text: formatError(error),
      }],
      isError: true,
    };
  }
}

export const serveTool = {
  name: 'mloop_serve',
  description: 'Start the MLoop REST API server for serving predictions via HTTP.',
  inputSchema: {
    type: 'object',
    properties: {
      projectPath: {
        type: 'string',
        description: 'Path to MLoop project directory',
      },
      port: {
        type: 'number',
        description: 'Port number to listen on (default: 5000)',
      },
      host: {
        type: 'string',
        description: 'Host address to bind to',
      },
    },
    required: ['projectPath'],
  },
  handler: serve,
};

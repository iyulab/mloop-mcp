/**
 * mloop_logs tool - View prediction logs
 */

import { z } from 'zod';
import { executeMloop, buildArgs } from '../executor.js';
import { parseCliOutput } from '../utils/parser.js';
import { formatError } from '../utils/errors.js';

export const logsSchema = z.object({
  projectPath: z.string().describe('Path to MLoop project directory'),
  modelName: z.string().optional().describe('Model name (default: "default")'),
  limit: z.number().positive().optional().describe('Maximum number of log entries to show'),
});

export type LogsParams = z.infer<typeof logsSchema>;

export async function logs(params: LogsParams): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  try {
    const cliParams: Record<string, unknown> = {};
    if (params.modelName) cliParams['name'] = params.modelName;
    if (params.limit) cliParams['limit'] = params.limit;

    const args = buildArgs('logs', cliParams);
    const result = await executeMloop(args, { cwd: params.projectPath });
    const output = parseCliOutput(result.stdout);

    return {
      content: [{
        type: 'text',
        text: output || 'No prediction logs found.',
      }],
    };
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: formatError(error),
      }],
      isError: true,
    };
  }
}

export const logsTool = {
  name: 'mloop_logs',
  description: 'View prediction logs for a model. Shows recent predictions with timestamps and results.',
  inputSchema: {
    type: 'object',
    properties: {
      projectPath: {
        type: 'string',
        description: 'Path to MLoop project directory',
      },
      modelName: {
        type: 'string',
        description: 'Model name (default: "default")',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of log entries to show',
      },
    },
    required: ['projectPath'],
  },
  handler: logs,
};

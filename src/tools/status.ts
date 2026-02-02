/**
 * mloop_status tool - Project status overview
 */

import { z } from 'zod';
import { executeMloop } from '../executor.js';
import { parseCliOutput } from '../utils/parser.js';
import { formatError } from '../utils/errors.js';

export const statusSchema = z.object({
  projectPath: z.string().describe('Path to MLoop project directory'),
});

export type StatusParams = z.infer<typeof statusSchema>;

export async function status(params: StatusParams): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  try {
    const { projectPath } = params;

    const args: string[] = ['status'];

    const result = await executeMloop(args, {
      cwd: projectPath,
    });

    const output = parseCliOutput(result.stdout);

    return {
      content: [{
        type: 'text',
        text: output || 'No status information available.',
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

export const statusTool = {
  name: 'mloop_status',
  description: 'Show MLoop project status including models, experiments, and production deployments.',
  inputSchema: {
    type: 'object',
    properties: {
      projectPath: {
        type: 'string',
        description: 'Path to MLoop project directory',
      },
    },
    required: ['projectPath'],
  },
  handler: status,
};

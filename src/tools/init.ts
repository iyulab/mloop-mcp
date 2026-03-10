/**
 * mloop_init tool - Initialize a new MLoop project
 */

import { z } from 'zod';
import { mkdirSync } from 'fs';
import { executeMloop, buildArgsWithPositional } from '../executor.js';
import { parseCliOutput } from '../utils/parser.js';
import { formatError } from '../utils/errors.js';

export const initSchema = z.object({
  projectPath: z.string().describe('Path to create/initialize the MLoop project'),
  task: z.enum(['binary-classification', 'multiclass-classification', 'regression'])
    .describe('ML task type for this project'),
});

export type InitParams = z.infer<typeof initSchema>;

export async function init(params: InitParams): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  try {
    // Ensure project directory exists
    mkdirSync(params.projectPath, { recursive: true });

    const args = buildArgsWithPositional('init', ['.'], { task: params.task });
    const result = await executeMloop(args, { cwd: params.projectPath });
    const output = parseCliOutput(result.stdout);

    return {
      content: [{
        type: 'text',
        text: output || 'Project initialized successfully.',
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

export const initTool = {
  name: 'mloop_init',
  description: 'Initialize a new MLoop project. Creates mloop.yaml, datasets/, models/ directories.',
  inputSchema: {
    type: 'object',
    properties: {
      projectPath: {
        type: 'string',
        description: 'Path to create/initialize the MLoop project',
      },
      task: {
        type: 'string',
        enum: ['binary-classification', 'multiclass-classification', 'regression'],
        description: 'ML task type for this project',
      },
    },
    required: ['projectPath', 'task'],
  },
  handler: init,
};

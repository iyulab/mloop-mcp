/**
 * mloop_promote tool - Promote experiment to production
 */

import { z } from 'zod';
import { executeMloop } from '../executor.js';
import { parseCliOutput } from '../utils/parser.js';
import { formatError } from '../utils/errors.js';

export const promoteSchema = z.object({
  projectPath: z.string().describe('Path to MLoop project directory'),
  experimentId: z.string().describe('Experiment ID to promote (e.g., exp-003)'),
  modelName: z.string().optional().describe('Model name'),
  force: z.boolean().optional().describe('Skip confirmation'),
});

export type PromoteParams = z.infer<typeof promoteSchema>;

export async function promote(params: PromoteParams): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  try {
    const { projectPath, experimentId, modelName, force } = params;

    const args: string[] = ['promote', experimentId];
    if (modelName) {
      args.push('--name', modelName);
    }
    if (force) {
      args.push('--force');
    }

    const result = await executeMloop(args, {
      cwd: projectPath,
    });

    const output = parseCliOutput(result.stdout);

    return {
      content: [{
        type: 'text',
        text: output || `Experiment ${experimentId} promoted to production successfully.`,
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

export const promoteTool = {
  name: 'mloop_promote',
  description: 'Promote an experiment to production. The experiment\'s model will be used for predictions.',
  inputSchema: {
    type: 'object',
    properties: {
      projectPath: {
        type: 'string',
        description: 'Path to MLoop project directory',
      },
      experimentId: {
        type: 'string',
        description: 'Experiment ID to promote (e.g., exp-003)',
      },
      modelName: {
        type: 'string',
        description: 'Model name for namespacing',
      },
      force: {
        type: 'boolean',
        description: 'Skip confirmation prompt',
      },
    },
    required: ['projectPath', 'experimentId'],
  },
  handler: promote,
};

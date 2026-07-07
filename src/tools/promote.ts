/**
 * mloop_promote tool - Promote experiment to production
 */

import { z } from 'zod';
import { executeMloop } from '../executor.js';
import { parseCliOutput } from '../utils/parser.js';
import { formatError } from '../utils/errors.js';

export const promoteSchema = z.object({
  projectPath: z.string().describe('Path to MLoop project directory'),
  experimentId: z.string().optional().describe('Experiment ID to promote (e.g., exp-003); omit when using latest/best'),
  latest: z.boolean().optional().describe('Promote the most recent completed experiment'),
  best: z.boolean().optional().describe('Promote the completed experiment with the best metric (direction-aware)'),
  modelName: z.string().optional().describe('Model name'),
  force: z.boolean().optional().describe('Skip confirmation'),
});

export type PromoteParams = z.infer<typeof promoteSchema>;

export async function promote(params: PromoteParams): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  try {
    const { projectPath, experimentId, latest, best, modelName, force } = params;

    // Mirror the CLI's selector contract client-side so the agent gets an immediate, clear error.
    const selectors = (experimentId ? 1 : 0) + (latest ? 1 : 0) + (best ? 1 : 0);
    if (selectors !== 1) {
      return {
        content: [{
          type: 'text',
          text: selectors === 0
            ? 'Specify exactly one of: experimentId, latest, or best.'
            : 'Use only one of: experimentId, latest, best.',
        }],
        isError: true,
      };
    }

    const args: string[] = ['promote'];
    if (experimentId) args.push(experimentId);
    if (latest) args.push('--latest');
    if (best) args.push('--best');
    if (modelName) args.push('--name', modelName);
    if (force) args.push('--force');
    // Structured, non-interactive output (mloop >= 0.21): result object or {"error": ...}.
    args.push('--json');

    const result = await executeMloop(args, {
      cwd: projectPath,
    });

    const output = parseCliOutput(result.stdout);

    return {
      content: [{
        type: 'text',
        text: output || `Experiment ${experimentId ?? '(auto-selected)'} promoted to production successfully.`,
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
  description: 'Promote an experiment to production. Select by explicit ID, or auto-select with latest (newest completed) / best (best metric, direction-aware). The promoted model will be used for predictions.',
  inputSchema: {
    type: 'object',
    properties: {
      projectPath: {
        type: 'string',
        description: 'Path to MLoop project directory',
      },
      experimentId: {
        type: 'string',
        description: 'Experiment ID to promote (e.g., exp-003); omit when using latest/best',
      },
      latest: {
        type: 'boolean',
        description: 'Promote the most recent completed experiment',
      },
      best: {
        type: 'boolean',
        description: 'Promote the completed experiment with the best metric (direction-aware: error metrics pick the minimum)',
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
    required: ['projectPath'],
  },
  handler: promote,
};

/**
 * mloop_list tool - List experiments and models
 */

import { z } from 'zod';
import { executeMloop, buildArgs } from '../executor.js';
import { parseCliOutput } from '../utils/parser.js';
import { formatError } from '../utils/errors.js';

export const listSchema = z.object({
  projectPath: z.string().describe('Path to MLoop project directory'),
  modelName: z.string().optional().describe('Filter by model name'),
  showAll: z.boolean().optional().describe('Include failed experiments'),
});

export type ListParams = z.infer<typeof listSchema>;

export async function list(params: ListParams): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  try {
    const { projectPath, modelName, showAll } = params;

    const cliParams: Record<string, unknown> = {};
    if (modelName) cliParams['name'] = modelName;
    if (showAll) cliParams['all'] = true;

    const args = buildArgs('list', cliParams);

    const result = await executeMloop(args, {
      cwd: projectPath,
    });

    const output = parseCliOutput(result.stdout);

    return {
      content: [{
        type: 'text',
        text: output || 'No experiments found.',
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

export const listTool = {
  name: 'mloop_list',
  description: 'List all experiments and their metrics for a model.',
  inputSchema: {
    type: 'object',
    properties: {
      projectPath: {
        type: 'string',
        description: 'Path to MLoop project directory',
      },
      modelName: {
        type: 'string',
        description: 'Filter experiments by model name',
      },
      showAll: {
        type: 'boolean',
        description: 'Show all experiments including failed ones',
      },
    },
    required: ['projectPath'],
  },
  handler: list,
};

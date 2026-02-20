/**
 * mloop_prep tool - Run preprocessing pipeline
 */

import { z } from 'zod';
import { executeMloop, buildArgsWithPositional } from '../executor.js';
import { parseCliOutput } from '../utils/parser.js';
import { formatError } from '../utils/errors.js';

export const prepSchema = z.object({
  projectPath: z.string().describe('Path to MLoop project directory'),
  config: z.string().optional().describe('Preprocessing config file path'),
});

export type PrepParams = z.infer<typeof prepSchema>;

export async function prep(params: PrepParams): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  try {
    const cliParams: Record<string, unknown> = {};
    if (params.config) cliParams['config'] = params.config;

    const args = buildArgsWithPositional('prep', ['run'], cliParams);
    const result = await executeMloop(args, { cwd: params.projectPath });
    const output = parseCliOutput(result.stdout);

    return {
      content: [{
        type: 'text',
        text: output || 'Preprocessing completed successfully.',
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

export const prepTool = {
  name: 'mloop_prep',
  description: 'Run the data preprocessing pipeline. Executes preprocessing scripts defined in the project configuration.',
  inputSchema: {
    type: 'object',
    properties: {
      projectPath: {
        type: 'string',
        description: 'Path to MLoop project directory',
      },
      config: {
        type: 'string',
        description: 'Preprocessing config file path',
      },
    },
    required: ['projectPath'],
  },
  handler: prep,
};

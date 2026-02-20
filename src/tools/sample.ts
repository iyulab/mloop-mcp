/**
 * mloop_sample tool - Data sampling operations
 */

import { z } from 'zod';
import { executeMloop, buildArgsWithPositional } from '../executor.js';
import { parseCliOutput } from '../utils/parser.js';
import { formatError } from '../utils/errors.js';

export const sampleSchema = z.object({
  projectPath: z.string().describe('Path to MLoop project directory'),
  action: z.enum(['create', 'stats']).describe('Sample action to perform'),
  dataFile: z.string().optional().describe('Data file to sample from'),
  size: z.number().positive().optional().describe('Sample size (number of rows)'),
  strategy: z.string().optional().describe('Sampling strategy (e.g., "random", "stratified")'),
});

export type SampleParams = z.infer<typeof sampleSchema>;

export async function sample(params: SampleParams): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  try {
    const positional: string[] = [params.action];
    if (params.dataFile) positional.push(params.dataFile);

    const cliParams: Record<string, unknown> = {};
    if (params.size) cliParams['size'] = params.size;
    if (params.strategy) cliParams['strategy'] = params.strategy;

    const args = buildArgsWithPositional('sample', positional, cliParams);
    const result = await executeMloop(args, { cwd: params.projectPath });
    const output = parseCliOutput(result.stdout);

    return {
      content: [{
        type: 'text',
        text: output || `Sample ${params.action} completed.`,
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

export const sampleTool = {
  name: 'mloop_sample',
  description: 'Create data samples or view sampling statistics. Supports random and stratified sampling strategies.',
  inputSchema: {
    type: 'object',
    properties: {
      projectPath: {
        type: 'string',
        description: 'Path to MLoop project directory',
      },
      action: {
        type: 'string',
        enum: ['create', 'stats'],
        description: 'Sample action: "create" to generate a sample, "stats" to view statistics',
      },
      dataFile: {
        type: 'string',
        description: 'Data file to sample from',
      },
      size: {
        type: 'number',
        description: 'Sample size (number of rows)',
      },
      strategy: {
        type: 'string',
        description: 'Sampling strategy (e.g., "random", "stratified")',
      },
    },
    required: ['projectPath', 'action'],
  },
  handler: sample,
};

/**
 * mloop_compare tool - Compare experiments
 */

import { z } from 'zod';
import { executeMloop } from '../executor.js';
import { parseCliOutput } from '../utils/parser.js';
import { formatError } from '../utils/errors.js';

export const compareSchema = z.object({
  projectPath: z.string().describe('Path to MLoop project directory'),
  experiments: z.array(z.string()).min(2).describe('Experiment IDs to compare (at least 2)'),
  modelName: z.string().optional().describe('Model name'),
});

export type CompareParams = z.infer<typeof compareSchema>;

export async function compare(params: CompareParams): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  try {
    const { projectPath, experiments, modelName } = params;

    const args: string[] = ['compare', ...experiments];
    if (modelName) {
      args.push('--name', modelName);
    }

    const result = await executeMloop(args, {
      cwd: projectPath,
    });

    const output = parseCliOutput(result.stdout);

    return {
      content: [{
        type: 'text',
        text: output || 'No comparison data available.',
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

export const compareTool = {
  name: 'mloop_compare',
  description: 'Compare metrics across multiple experiments to identify the best performing model.',
  handler: compare,
};

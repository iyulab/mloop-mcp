/**
 * mloop_compare tool - Compare experiments
 */

import { z } from 'zod';
import { executeMloop } from '../executor.js';
import { parseCliOutput } from '../utils/parser.js';
import { formatError } from '../utils/errors.js';

export const compareSchema = z.object({
  projectPath: z.string().describe('Path to MLoop project directory'),
  experiments: z.array(z.string()).min(2).optional().describe('Experiment IDs to compare (at least 2; leave out to compare the model\'s completed experiments)'),
  modelName: z.string().optional().describe('Model name'),
  best: z.number().int().positive().optional().describe('Compare only the top N experiments by metric (without experiments)'),
  metric: z.string().optional().describe('Rank by this metric instead of the one the model was trained to optimize'),
  metricsFile: z.string().optional().describe('Rank candidates from a JSON file of metrics, with no MLoop project needed (an external system of record\'s candidates): [{"id": ..., "metrics": {...}}, ...]'),
});

export type CompareParams = z.infer<typeof compareSchema>;

export async function compare(params: CompareParams): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  try {
    const { projectPath, experiments = [], modelName, best, metric, metricsFile } = params;

    const args: string[] = ['compare', ...experiments, '--json'];
    if (modelName) {
      args.push('--name', modelName);
    }
    if (best !== undefined) args.push('--best', String(best));
    if (metric) args.push('--metric', metric);
    if (metricsFile) args.push('--metrics-file', metricsFile);

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

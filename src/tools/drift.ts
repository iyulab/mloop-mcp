/**
 * mloop_drift tool - Compare recent inputs with the training data (PSI per column)
 */

import { z } from 'zod';
import { executeMloop } from '../executor.js';
import { parseCliOutput } from '../utils/parser.js';
import { formatError } from '../utils/errors.js';

export const driftSchema = z.object({
  projectPath: z.string().describe('Path to MLoop project directory'),
  modelName: z.string().optional().describe('Model name (default: "default")'),
  rows: z.number().int().optional().describe('How many of the most recent logged predictions to compare (default 5000, at least 100)'),
  sliceBy: z.string().optional().describe('Also report drift per value of this input column (values with 100+ predictions)'),
});

export type DriftParams = z.infer<typeof driftSchema>;

export async function drift(params: DriftParams): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  try {
    const args = ['drift', '--json'];
    if (params.modelName) args.push('--name', params.modelName);
    if (params.rows !== undefined) args.push('--rows', String(params.rows));
    if (params.sliceBy) args.push('--slice-by', params.sliceBy);

    const result = await executeMloop(args, { cwd: params.projectPath });

    return {
      content: [{
        type: 'text',
        text: parseCliOutput(result.stdout) || 'No drift output.',
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

export const driftTool = {
  name: 'mloop_drift',
  description: 'How far the production model\'s recent inputs (its own logged predictions) have moved from the data it was trained on, as JSON: status (Measured, NoProduction, NoProfile, TooFewRows), and per column the population stability index (PSI — under 0.1 stable, 0.1–0.25 moderate, 0.25+ significant), its level and the bin that moved most with its training and current share; with sliceBy, the same per value of an input column. Use it to decide where to look harder or whether to retrain (mloop >= 0.38).',
  inputSchema: {
    type: 'object',
    properties: {
      projectPath: { type: 'string', description: 'Path to MLoop project directory' },
      modelName: { type: 'string', description: 'Model name (default: "default")' },
      rows: { type: 'number', description: 'How many of the most recent logged predictions to compare (default 5000, at least 100)' },
      sliceBy: { type: 'string', description: 'Also report drift per value of this input column' },
    },
    required: ['projectPath'],
  },
  handler: drift,
};

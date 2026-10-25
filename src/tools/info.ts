/**
 * mloop_info tool - Dataset profiling and analysis
 */

import { z } from 'zod';
import { executeMloop } from '../executor.js';
import { parseCliOutput } from '../utils/parser.js';
import { formatError } from '../utils/errors.js';

export const infoSchema = z.object({
  dataFile: z.string().describe('Path to data file to analyze'),
  projectPath: z.string().optional().describe('MLoop project path (optional, for relative paths)'),
  label: z.string().optional().describe('Label column name (overrides mloop.yaml setting)'),
  modelName: z.string().optional().describe('Model name to read label configuration from mloop.yaml (default: "default")'),
  analyze: z.boolean().optional().describe('Enable deep analysis including correlation, feature importance, distribution, and anomaly detection'),
  sampleSize: z.number().optional().describe('Maximum number of rows to sample for deep analysis (default: 50000)'),
});

export type InfoParams = z.infer<typeof infoSchema>;

export async function info(params: InfoParams): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  try {
    const { dataFile, projectPath, label, modelName, analyze, sampleSize } = params;

    const args: string[] = ['info', dataFile, '--json'];
    if (label) {
      args.push('--label', label);
    }
    if (modelName) {
      args.push('--name', modelName);
    }
    if (analyze) {
      args.push('--analyze');
    }
    if (sampleSize !== undefined && sampleSize !== null) {
      args.push('--sample-size', String(sampleSize));
    }

    const result = await executeMloop(args, {
      cwd: projectPath,
    });

    const output = parseCliOutput(result.stdout);

    return {
      content: [{
        type: 'text',
        text: output || 'No data analysis available.',
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

export const infoTool = {
  name: 'mloop_info',
  description: 'Analyze and profile a dataset. Shows column types, statistics, missing values, and more. Can read label column from mloop.yaml configuration.',
  handler: info,
};

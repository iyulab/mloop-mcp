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
});

export type InfoParams = z.infer<typeof infoSchema>;

export async function info(params: InfoParams): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  try {
    const { dataFile, projectPath, label, modelName } = params;

    const args: string[] = ['info', dataFile];
    if (label) {
      args.push('--label', label);
    }
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
  inputSchema: {
    type: 'object',
    properties: {
      dataFile: {
        type: 'string',
        description: 'Path to the data file to analyze (CSV)',
      },
      projectPath: {
        type: 'string',
        description: 'MLoop project path for resolving relative paths',
      },
      label: {
        type: 'string',
        description: 'Label column name (overrides mloop.yaml setting)',
      },
      modelName: {
        type: 'string',
        description: 'Model name to read label configuration from mloop.yaml (default: "default")',
      },
    },
    required: ['dataFile'],
  },
  handler: info,
};

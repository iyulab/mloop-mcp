/**
 * mloop_predict tool - Run predictions with trained models
 */

import { z } from 'zod';
import { executeMloop, buildArgsWithPositional } from '../executor.js';
import { parseCliOutput } from '../utils/parser.js';
import { formatError } from '../utils/errors.js';

export const predictSchema = z.object({
  projectPath: z.string().describe('Path to MLoop project directory'),
  dataFile: z.string().optional().describe('Prediction data file (default: datasets/predict.csv)'),
  modelName: z.string().optional().describe('Model name'),
  output: z.string().optional().describe('Output file path'),
  log: z.boolean().optional().describe('Enable prediction logging'),
});

export type PredictParams = z.infer<typeof predictSchema>;

export async function predict(params: PredictParams): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  try {
    const { projectPath, dataFile, modelName, output, log } = params;

    // dataFile is a positional argument
    const positional: string[] = [];
    if (dataFile) positional.push(dataFile);

    const cliParams: Record<string, unknown> = {};
    if (modelName) cliParams['name'] = modelName;
    if (output) cliParams['output'] = output;
    if (log) cliParams['log'] = true;

    const args = buildArgsWithPositional('predict', positional, cliParams);

    const result = await executeMloop(args, {
      cwd: projectPath,
    });

    const outputText = parseCliOutput(result.stdout);

    return {
      content: [{
        type: 'text',
        text: outputText || 'Prediction completed successfully.',
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

export const predictTool = {
  name: 'mloop_predict',
  description: 'Run predictions using a trained model. Uses production model by default.',
  inputSchema: {
    type: 'object',
    properties: {
      projectPath: {
        type: 'string',
        description: 'Path to MLoop project directory',
      },
      dataFile: {
        type: 'string',
        description: 'Input data file for predictions (default: datasets/predict.csv)',
      },
      modelName: {
        type: 'string',
        description: 'Model name to use for prediction',
      },
      output: {
        type: 'string',
        description: 'Output file path for predictions',
      },
      log: {
        type: 'boolean',
        description: 'Enable prediction logging to DataStore',
      },
    },
    required: ['projectPath'],
  },
  handler: predict,
};

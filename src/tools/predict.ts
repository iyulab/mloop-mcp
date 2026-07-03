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
  unknownStrategy: z.enum(['auto', 'error', 'use-most-frequent', 'use-missing']).optional()
    .describe('Strategy for handling unknown categorical values in prediction data'),
});

export type PredictParams = z.infer<typeof predictSchema>;

export async function predict(params: PredictParams): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  try {
    const { projectPath, dataFile, modelName, output, log, unknownStrategy } = params;

    // dataFile is a positional argument
    const positional: string[] = [];
    if (dataFile) positional.push(dataFile);

    const cliParams: Record<string, unknown> = {};
    if (modelName) cliParams['name'] = modelName;
    if (output) cliParams['output'] = output;
    if (log) cliParams['log'] = true;
    if (unknownStrategy) cliParams['unknown-strategy'] = unknownStrategy;

    // Structured propagation: without an explicit output file, request `--json` so the agent receives the
    // full prediction rows (predictedLabel, probabilities, conformal band, and the normalized `confidence`
    // MLoop now owns) instead of scraped Spectre text — this is what unblocked MCP structured consumption.
    // An explicit `output` keeps the file-writing (CSV) path with its text summary.
    const wantsFile = !!output;
    if (!wantsFile) cliParams['json'] = true;

    const args = buildArgsWithPositional('predict', positional, cliParams);

    const result = await executeMloop(args, {
      cwd: projectPath,
    });

    let outputText: string;
    if (!wantsFile) {
      // `--json` emits one JSON object on stdout. Fall back to text parsing for an older CLI without it.
      try {
        outputText = JSON.stringify(JSON.parse(result.stdout.trim()), null, 2);
      } catch {
        outputText = parseCliOutput(result.stdout) || 'Prediction completed successfully.';
      }
    } else {
      outputText = parseCliOutput(result.stdout) || 'Prediction completed successfully.';
    }

    return {
      content: [{
        type: 'text',
        text: outputText,
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
      unknownStrategy: {
        type: 'string',
        enum: ['auto', 'error', 'use-most-frequent', 'use-missing'],
        description: 'Strategy for handling unknown categorical values: "auto" (auto-select based on ratio, default), "error" (fail on unknowns), "use-most-frequent" (replace with most common value), "use-missing" (replace with empty)',
      },
    },
    required: ['projectPath'],
  },
  handler: predict,
};

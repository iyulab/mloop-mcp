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
  experimentId: z.string().optional()
    .describe('Predict with this experiment (e.g. a staging candidate) instead of production — production does not move'),
  model: z.string().optional().describe('Path to a model file to predict with instead of the production model'),
  output: z.string().optional().describe('Output file path'),
  log: z.boolean().optional().describe('Log the predictions; without an output file each returned row carries the predictionId that feedback takes'),
  includeFeatures: z.boolean().optional().describe('Whether the output file repeats the input feature columns (the CLI default is yes; false leaves them out)'),
  records: z.string().optional().describe('For a JSON data file: the dotted path to the array whose items are the rows'),
  unknownStrategy: z.enum(['auto', 'error', 'use-most-frequent', 'use-missing']).optional()
    .describe('Strategy for handling unknown categorical values in prediction data'),
});

export type PredictParams = z.infer<typeof predictSchema>;

export async function predict(params: PredictParams): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  try {
    const { projectPath, dataFile, modelName, model, experimentId, output, log, unknownStrategy, includeFeatures, records } = params;

    // dataFile is a positional argument
    const positional: string[] = [];
    if (dataFile) positional.push(dataFile);

    const cliParams: Record<string, unknown> = {};
    if (modelName) cliParams['name'] = modelName;
    if (experimentId) cliParams['experiment'] = experimentId;
    if (model) cliParams['model'] = model;
    if (output) cliParams['output'] = output;
    if (log) cliParams['log'] = true;
    if (unknownStrategy) cliParams['unknown-strategy'] = unknownStrategy;
    if (includeFeatures === false) cliParams['include-features'] = 'false';
    if (records) cliParams['records'] = records;

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
  description: 'Run predictions using a trained model. Uses production model by default; `experimentId` predicts with that experiment instead (a shadow prediction — production does not move). The JSON names the model that answered in `experimentId`.',
  handler: predict,
};

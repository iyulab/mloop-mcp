/**
 * mloop_calibrate tool - Fit, show or remove a binary classifier's probability calibration
 */

import { z } from 'zod';
import { executeMloop } from '../executor.js';
import { parseCliOutput } from '../utils/parser.js';
import { formatError } from '../utils/errors.js';

export const calibrateSchema = z.object({
  projectPath: z.string().describe('Path to MLoop project directory'),
  experimentId: z.string().optional().describe('Experiment to calibrate (default: the production model)'),
  modelName: z.string().optional().describe('Model name'),
  dataFile: z.string().optional().describe('Labeled rows the calibration is fit on — rows the model was not trained on'),
  method: z.enum(['platt', 'isotonic', 'temperature']).optional().describe('Binary: platt (default; steady on a few hundred rows) or isotonic (no shape assumed, needs more rows). Multiclass: temperature (default; answers unchanged)'),
  weight: z.string().optional().describe('Column that weights the rows (1/π for a recheck sample)'),
  clear: z.boolean().optional().describe('Remove the calibration: the model answers with its own probabilities again'),
});

export type CalibrateParams = z.infer<typeof calibrateSchema>;

export async function calibrate(params: CalibrateParams): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  try {
    const { projectPath, experimentId, modelName, dataFile, method, weight, clear } = params;

    const args: string[] = ['calibrate'];
    if (experimentId) args.push(experimentId);
    if (modelName) args.push('--name', modelName);
    if (dataFile) args.push('--data', dataFile);
    if (method) args.push('--method', method);
    if (weight) args.push('--weight', weight);
    if (clear) args.push('--clear');
    args.push('--json');

    const result = await executeMloop(args, { cwd: projectPath });

    return {
      content: [{ type: 'text', text: parseCliOutput(result.stdout) || 'No calibration output.' }],
    };
  } catch (error) {
    return {
      content: [{ type: 'text', text: formatError(error) }],
      isError: true,
    };
  }
}

export const calibrateTool = {
  name: 'mloop_calibrate',
  description: 'A classifier\'s probability calibration, as JSON. With dataFile, fits a map from the model\'s own probability to how often it is right on those labeled rows (binary: platt or isotonic; multiclass: temperature, answers unchanged; weighted rows allowed) and writes it beside the model without retraining — predict, serve, evaluate (its ECE) and a threshold chosen afterwards then read calibrated probabilities, and promote carries it. Reports ECE before and after on the fit rows (in-sample). Refused while the model has a decision threshold (clear it, calibrate, choose it again). Without dataFile, shows the current one; with clear, removes it (mloop >= 0.40).',
  inputSchema: {
    type: 'object',
    properties: {
      projectPath: { type: 'string', description: 'Path to MLoop project directory' },
      experimentId: { type: 'string', description: 'Experiment (default: production)' },
      modelName: { type: 'string', description: 'Model name for namespacing' },
      dataFile: { type: 'string', description: 'Labeled rows to fit on' },
      method: { type: 'string', enum: ['platt', 'isotonic', 'temperature'], description: 'Calibration method (default: platt for binary, temperature for multiclass)' },
      weight: { type: 'string', description: 'Column that weights the rows' },
      clear: { type: 'boolean', description: 'Remove the calibration' },
    },
    required: ['projectPath'],
  },
  handler: calibrate,
};

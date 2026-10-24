/**
 * mloop_train tool - Train ML models with AutoML
 */

import { z } from 'zod';
import { executeMloop, buildArgsWithPositional } from '../executor.js';
import { parseCliOutput } from '../utils/parser.js';
import { formatError } from '../utils/errors.js';

export const trainSchema = z.object({
  projectPath: z.string().describe('Path to MLoop project directory'),
  dataFile: z.string().optional().describe('Training data file (default: datasets/train.csv)'),
  label: z.string().optional().describe('Label column name'),
  task: z.enum(['binary-classification', 'multiclass-classification', 'regression'])
    .optional()
    .describe('ML task type'),
  time: z.number().positive().optional().describe('Training time in seconds'),
  metric: z.string().optional().describe('Optimization metric'),
  modelName: z.string().optional().describe('Model name (default: "default")'),
  balance: z.string().optional().describe('Class balancing strategy for classification (image classification included — it oversamples its training split): "auto" (balance to 10:1), "none", or target ratio (e.g., "5" for 5:1)'),
  testSplit: z.number().min(0).max(1).optional().describe('Test data split ratio (0.0-1.0, default: 0.2)'),
  noPromote: z.boolean().optional().describe('Skip automatic promotion to production'),
  dropMissingLabels: z.boolean().optional().describe('Drop rows with missing label values before training'),
  weight: z.string().optional().describe('Column that weights the rows (e.g. 1/π for sampled labels); never a feature'),
  additionalDataFiles: z.array(z.string()).optional().describe(
    'Files merged after dataFile (e.g. a retraining set from mloop_sample create); a file without the weight column counts its rows 1'),
  portable: z.boolean().optional().describe('Train only with steps ONNX can express, so mloop_export_onnx can export the model'),
});

export type TrainParams = z.infer<typeof trainSchema>;

export async function train(params: TrainParams): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  try {
    const { projectPath, dataFile, label, ...options } = params;

    // Build positional arguments
    // More than one file goes through --data, which merges them; one file is the positional argument.
    const more = options.additionalDataFiles ?? [];
    const positional: string[] = [];
    if (dataFile && more.length === 0) positional.push(dataFile);

    // Map parameters to CLI flags
    const cliParams: Record<string, unknown> = {};
    if (label) cliParams['label'] = label;
    if (options.task) cliParams['task'] = options.task;
    if (options.time) cliParams['time'] = options.time;
    if (options.metric) cliParams['metric'] = options.metric;
    if (options.modelName) cliParams['name'] = options.modelName;
    if (options.balance) cliParams['balance'] = options.balance;
    if (options.testSplit !== undefined) cliParams['test-split'] = options.testSplit;
    if (options.noPromote) cliParams['no-promote'] = true;
    if (options.dropMissingLabels) cliParams['drop-missing-labels'] = true;
    if (options.weight) cliParams['weight'] = options.weight;
    if (options.portable) cliParams['portable'] = true;

    const args = buildArgsWithPositional('train', positional, cliParams);
    if (more.length > 0) args.push('--data', dataFile ?? 'datasets/train.csv', ...more);

    const result = await executeMloop(args, {
      cwd: projectPath,
      timeout: 600_000, // 10 minutes for training
    });

    const output = parseCliOutput(result.stdout);

    return {
      content: [{
        type: 'text',
        text: output || 'Training completed successfully.',
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

export const trainTool = {
  name: 'mloop_train',
  description: 'Train an ML model using AutoML. Runs mloop train command with specified parameters.',
  handler: train,
};

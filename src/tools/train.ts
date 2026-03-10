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
  balance: z.string().optional().describe('Class balancing strategy: "auto" (balance to 10:1), "none", or target ratio (e.g., "5" for 5:1)'),
  testSplit: z.number().min(0).max(1).optional().describe('Test data split ratio (0.0-1.0, default: 0.2)'),
  noPromote: z.boolean().optional().describe('Skip automatic promotion to production'),
  dropMissingLabels: z.boolean().optional().describe('Drop rows with missing label values before training'),
});

export type TrainParams = z.infer<typeof trainSchema>;

export async function train(params: TrainParams): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  try {
    const { projectPath, dataFile, label, ...options } = params;

    // Build positional arguments
    const positional: string[] = [];
    if (dataFile) positional.push(dataFile);

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

    const args = buildArgsWithPositional('train', positional, cliParams);

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
  inputSchema: {
    type: 'object',
    properties: {
      projectPath: {
        type: 'string',
        description: 'Path to MLoop project directory',
      },
      dataFile: {
        type: 'string',
        description: 'Training data file path (default: datasets/train.csv)',
      },
      label: {
        type: 'string',
        description: 'Label column name for training',
      },
      task: {
        type: 'string',
        enum: ['binary-classification', 'multiclass-classification', 'regression'],
        description: 'ML task type',
      },
      time: {
        type: 'number',
        description: 'Training time limit in seconds',
      },
      metric: {
        type: 'string',
        description: 'Optimization metric (e.g., Accuracy, F1Score, RSquared)',
      },
      modelName: {
        type: 'string',
        description: 'Model name for namespacing (default: "default")',
      },
      balance: {
        type: 'string',
        description: 'Class balancing strategy for imbalanced datasets: "auto" (balance to 10:1 if needed), "none" (no balancing), or a number like "5" for 5:1 target ratio',
      },
      testSplit: {
        type: 'number',
        description: 'Test data split ratio (0.0-1.0, default: 0.2)',
      },
      noPromote: {
        type: 'boolean',
        description: 'Skip automatic promotion to production after training',
      },
      dropMissingLabels: {
        type: 'boolean',
        description: 'Drop rows with missing label values before training',
      },
    },
    required: ['projectPath'],
  },
  handler: train,
};

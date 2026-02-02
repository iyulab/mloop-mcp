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
});

export type TrainParams = z.infer<typeof trainSchema>;

export async function train(params: TrainParams): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  try {
    const { projectPath, dataFile, label, ...options } = params;

    // Build positional arguments
    const positional: string[] = [];
    if (dataFile) positional.push(dataFile);
    if (label) positional.push(label);

    // Map parameters to CLI flags
    const cliParams: Record<string, unknown> = {};
    if (options.task) cliParams['task'] = options.task;
    if (options.time) cliParams['time'] = options.time;
    if (options.metric) cliParams['metric'] = options.metric;
    if (options.modelName) cliParams['name'] = options.modelName;

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
    },
    required: ['projectPath'],
  },
  handler: train,
};

/**
 * mloop_auto_train tool - Automated training pipeline: info -> train -> list
 */

import { z } from 'zod';
import { executeMloop, buildArgsWithPositional, buildArgs } from '../executor.js';
import { parseCliOutput } from '../utils/parser.js';
import { formatError } from '../utils/errors.js';

export const autoTrainSchema = z.object({
  projectPath: z.string().describe('Project directory path'),
  dataFile: z.string().optional().describe('Training data file (default: datasets/train.csv)'),
  label: z.string().optional().describe('Label column (uses mloop.yaml default if omitted)'),
  modelName: z.string().optional().describe('Model name (default: "default")'),
  time: z.number().positive().optional().describe('Training time (omit for auto-time)'),
});

export type AutoTrainParams = z.infer<typeof autoTrainSchema>;

export async function autoTrain(params: AutoTrainParams): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  const steps: string[] = [];
  try {
    // Step 1: Info (optional, for reporting)
    if (params.dataFile) {
      const infoArgs = buildArgsWithPositional('info', [params.dataFile], {});
      await executeMloop(infoArgs, { cwd: params.projectPath });
      steps.push('Data profiled');
    }

    // Step 2: Train
    const trainPositional: string[] = [];
    if (params.dataFile) trainPositional.push(params.dataFile);

    const trainOpts: Record<string, unknown> = {};
    if (params.label) trainOpts['label'] = params.label;
    if (params.time) trainOpts['time'] = params.time;
    if (params.modelName) trainOpts['name'] = params.modelName;

    const trainArgs = buildArgsWithPositional('train', trainPositional, trainOpts);
    const trainResult = await executeMloop(trainArgs, {
      cwd: params.projectPath,
      timeout: 1_200_000,
    });
    const trainOutput = parseCliOutput(trainResult.stdout);
    steps.push('Training complete');

    // Step 3: List experiments
    const listOpts: Record<string, unknown> = {};
    if (params.modelName) listOpts['name'] = params.modelName;
    const listArgs = buildArgs('list', listOpts);
    const listResult = await executeMloop(listArgs, { cwd: params.projectPath });
    steps.push('Experiments listed');

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          summary: 'Auto-train complete',
          steps,
          training_output: trainOutput,
          experiments: parseCliOutput(listResult.stdout),
        }, null, 2),
      }],
    };
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: false,
          summary: 'Auto-train failed',
          steps_completed: steps,
          error: formatError(error),
        }, null, 2),
      }],
      isError: true,
    };
  }
}

export const autoTrainTool = {
  name: 'mloop_auto_train',
  description: 'Automated training pipeline: profile data -> train (with auto-time) -> list experiments. Handles the full training workflow in a single call.',
  inputSchema: {
    type: 'object',
    properties: {
      projectPath: {
        type: 'string',
        description: 'Project directory path',
      },
      dataFile: {
        type: 'string',
        description: 'Training data file path (default: datasets/train.csv)',
      },
      label: {
        type: 'string',
        description: 'Label column name (uses mloop.yaml default if omitted)',
      },
      modelName: {
        type: 'string',
        description: 'Model name (default: "default")',
      },
      time: {
        type: 'number',
        description: 'Training time in seconds (omit for auto-time)',
      },
    },
    required: ['projectPath'],
  },
  handler: autoTrain,
};

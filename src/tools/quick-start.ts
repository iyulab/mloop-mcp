/**
 * mloop_quick_start tool - One-step project setup: init -> train -> auto-promote
 */

import { z } from 'zod';
import { mkdirSync } from 'fs';
import { executeMloop, buildArgsWithPositional } from '../executor.js';
import { parseCliOutput } from '../utils/parser.js';
import { formatError } from '../utils/errors.js';

export const quickStartSchema = z.object({
  projectPath: z.string().describe('Project directory path'),
  dataFile: z.string().describe('Training data CSV file path'),
  label: z.string().describe('Label column name'),
  task: z.enum(['binary-classification', 'multiclass-classification', 'regression'])
    .describe('ML task type'),
  time: z.number().positive().optional()
    .describe('Training time in seconds (omit for auto-time)'),
});

export type QuickStartParams = z.infer<typeof quickStartSchema>;

export async function quickStart(params: QuickStartParams): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  const steps: string[] = [];
  try {
    // Step 1: Init (ensure directory exists)
    mkdirSync(params.projectPath, { recursive: true });
    const initArgs = buildArgsWithPositional('init', ['.'], { task: params.task });
    await executeMloop(initArgs, { cwd: params.projectPath });
    steps.push('Project initialized');

    // Step 2: Train (auto-time if time not specified)
    const trainParams: Record<string, unknown> = { label: params.label };
    if (params.time) trainParams['time'] = params.time;
    const trainArgs = buildArgsWithPositional('train', [params.dataFile], trainParams);
    const trainResult = await executeMloop(trainArgs, {
      cwd: params.projectPath,
      timeout: 1_200_000, // 20 min for auto-time
    });
    const trainOutput = parseCliOutput(trainResult.stdout);
    steps.push('Model trained');

    // Extract experiment ID from output
    const expMatch = trainOutput.match(/Experiment ID:\s*(exp-\d+)/);
    const expId = expMatch?.[1] ?? 'exp-001';

    // Check if auto-promoted
    if (trainOutput.includes('promoted to production')) {
      steps.push(`${expId} auto-promoted to production`);
    }

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          summary: `Project initialized and model trained (${expId})`,
          steps,
          training_output: trainOutput,
        }, null, 2),
      }],
    };
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: false,
          summary: 'Quick start failed',
          steps_completed: steps,
          error: formatError(error),
        }, null, 2),
      }],
      isError: true,
    };
  }
}

export const quickStartTool = {
  name: 'mloop_quick_start',
  description: 'One-step project setup: initialize -> train -> auto-promote. Provide data file, label, and task type to go from zero to production model.',
  inputSchema: {
    type: 'object',
    properties: {
      projectPath: {
        type: 'string',
        description: 'Project directory path',
      },
      dataFile: {
        type: 'string',
        description: 'Training data CSV file path',
      },
      label: {
        type: 'string',
        description: 'Label column name',
      },
      task: {
        type: 'string',
        enum: ['binary-classification', 'multiclass-classification', 'regression'],
        description: 'ML task type',
      },
      time: {
        type: 'number',
        description: 'Training time in seconds (omit for auto-time)',
      },
    },
    required: ['projectPath', 'dataFile', 'label', 'task'],
  },
  handler: quickStart,
};

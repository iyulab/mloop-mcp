/**
 * mloop_quick_start tool - One-step project setup: init -> train -> auto-promote
 */

import { z } from 'zod';
import { mkdirSync } from 'fs';
import type { ServerContext } from '@modelcontextprotocol/server';
import { executeMloop, buildArgsWithPositional } from '../executor.js';
import { runTraining } from '../training-run.js';
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

export async function quickStart(params: QuickStartParams, ctx?: ServerContext): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  const steps: string[] = [];
  try {
    // Step 1: Init (ensure directory exists)
    mkdirSync(params.projectPath, { recursive: true });
    const initArgs = buildArgsWithPositional('init', ['.'], { task: params.task, json: true });
    await executeMloop(initArgs, { cwd: params.projectPath });
    steps.push('Project initialized');

    // Step 2: Train (auto-time if time not specified)
    const trainParams: Record<string, unknown> = { label: params.label };
    if (params.time) trainParams['time'] = params.time;
    const trainArgs = buildArgsWithPositional('train', [params.dataFile], trainParams);
    const training = await runTraining(trainArgs, params.projectPath, params.time, ctx);
    steps.push('Model trained');

    const expId = String(training.result?.['experimentId'] ?? 'unknown');
    if (training.promotion?.['promoted'] === true) {
      steps.push(`${expId} auto-promoted to production`);
    }

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          summary: `Project initialized and model trained (${expId})`,
          steps,
          training: training,
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
  handler: quickStart,
};

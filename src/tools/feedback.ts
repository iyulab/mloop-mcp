/**
 * mloop_feedback tool - Manage feedback for predictions
 */

import { z } from 'zod';
import { executeMloop, buildArgsWithPositional } from '../executor.js';
import { parseCliOutput } from '../utils/parser.js';
import { formatError } from '../utils/errors.js';

export const feedbackSchema = z.object({
  projectPath: z.string().describe('Path to MLoop project directory'),
  action: z.enum(['add', 'list', 'metrics']).describe('Feedback action to perform'),
  modelName: z.string().optional().describe('Model name (default: "default")'),
  value: z.string().optional().describe('Feedback value (for "add" action)'),
  predictionId: z.string().optional().describe('Prediction ID to add feedback for'),
});

export type FeedbackParams = z.infer<typeof feedbackSchema>;

export async function feedback(params: FeedbackParams): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  try {
    const cliParams: Record<string, unknown> = {};
    if (params.modelName) cliParams['name'] = params.modelName;
    if (params.value) cliParams['value'] = params.value;
    if (params.predictionId) cliParams['prediction-id'] = params.predictionId;

    const args = buildArgsWithPositional('feedback', [params.action], cliParams);
    const result = await executeMloop(args, { cwd: params.projectPath });
    const output = parseCliOutput(result.stdout);

    return {
      content: [{
        type: 'text',
        text: output || `Feedback ${params.action} completed.`,
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

export const feedbackTool = {
  name: 'mloop_feedback',
  description: 'Manage feedback for model predictions. Add feedback, list existing feedback, or view feedback metrics.',
  inputSchema: {
    type: 'object',
    properties: {
      projectPath: {
        type: 'string',
        description: 'Path to MLoop project directory',
      },
      action: {
        type: 'string',
        enum: ['add', 'list', 'metrics'],
        description: 'Feedback action: "add" to submit feedback, "list" to view, "metrics" to see statistics',
      },
      modelName: {
        type: 'string',
        description: 'Model name (default: "default")',
      },
      value: {
        type: 'string',
        description: 'Feedback value (for "add" action)',
      },
      predictionId: {
        type: 'string',
        description: 'Prediction ID to add feedback for',
      },
    },
    required: ['projectPath', 'action'],
  },
  handler: feedback,
};

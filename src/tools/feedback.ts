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
  modelName: z.string().optional().describe('Model name for "list" and "metrics" (default: "default")'),
  predictionId: z.string().optional().describe('Prediction ID to add feedback for (required for "add")'),
  value: z.string().optional().describe('The actual (ground-truth) value (required for "add")'),
  source: z.string().optional().describe('Where the value came from, e.g. "human", "reviewer-llm" (for "add")'),
  weight: z.number().nonnegative().optional().describe(
    'How much this row counts in training and evaluation built from feedback — for a row reviewed with probability p, 1/p (for "add"; default 1)'),
});

export type FeedbackParams = z.infer<typeof feedbackSchema>;

/** The CLI arguments for one call — the option names `mloop feedback <action>` accepts. */
export function feedbackArgs(params: FeedbackParams): string[] {
  const cliParams: Record<string, unknown> = {};
  if (params.action === 'add') {
    cliParams['prediction-id'] = params.predictionId;
    cliParams['actual-value'] = params.value;
    cliParams['source'] = params.source;
    cliParams['weight'] = params.weight;
  } else {
    cliParams['model'] = params.modelName;
    cliParams['json'] = true;
  }
  return buildArgsWithPositional('feedback', [params.action], cliParams);
}

export async function feedback(params: FeedbackParams): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  try {
    if (params.action === 'add' && (!params.predictionId || params.value === undefined)) {
      return {
        content: [{ type: 'text', text: '"add" needs predictionId and value — the prediction ID from mloop_logs, and the actual value.' }],
        isError: true,
      };
    }

    const result = await executeMloop(feedbackArgs(params), { cwd: params.projectPath });
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
  description: 'Manage feedback for model predictions. Add the actual value for a logged prediction (with its source and an optional weight), list existing feedback, or view feedback metrics (accuracy is weighted when feedback carries weights).',
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
        description: 'Model name for "list" and "metrics" (default: "default")',
      },
      predictionId: {
        type: 'string',
        description: 'Prediction ID to add feedback for (required for "add")',
      },
      value: {
        type: 'string',
        description: 'The actual (ground-truth) value (required for "add")',
      },
      source: {
        type: 'string',
        description: 'Where the value came from, e.g. "human", "reviewer-llm" (for "add")',
      },
      weight: {
        type: 'number',
        minimum: 0,
        description: 'How much this row counts in training and evaluation built from feedback — for a row reviewed with probability p, 1/p (for "add"; default 1)',
      },
    },
    required: ['projectPath', 'action'],
  },
  handler: feedback,
};

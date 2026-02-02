/**
 * mloop_evaluate tool - Evaluate model performance
 */

import { z } from 'zod';
import { executeMloop } from '../executor.js';
import { parseCliOutput } from '../utils/parser.js';
import { formatError } from '../utils/errors.js';

export const evaluateSchema = z.object({
  projectPath: z.string().describe('Path to MLoop project directory'),
  dataFile: z.string().optional().describe('Test data file for evaluation'),
  modelName: z.string().optional().describe('Model name'),
  experimentId: z.string().optional().describe('Specific experiment to evaluate'),
});

export type EvaluateParams = z.infer<typeof evaluateSchema>;

export async function evaluate(params: EvaluateParams): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  try {
    const { projectPath, dataFile, modelName, experimentId } = params;

    // CLI usage: mloop evaluate [<experiment-id> [<test-data>]] [options]
    // Both experiment-id and test-data are positional arguments
    const args: string[] = ['evaluate'];

    // First positional: experiment-id (optional)
    if (experimentId) {
      args.push(experimentId);
    }

    // Second positional: test-data (optional, only if experiment-id is provided)
    if (dataFile) {
      // If no experimentId but has dataFile, we need to pass empty or use production
      if (!experimentId) {
        // Use 'production' as placeholder to indicate use production model
        args.push('production');
      }
      args.push(dataFile);
    }

    // Named option: --name
    if (modelName) {
      args.push('--name', modelName);
    }

    const result = await executeMloop(args, {
      cwd: projectPath,
    });

    const output = parseCliOutput(result.stdout);

    return {
      content: [{
        type: 'text',
        text: output || 'No evaluation results available.',
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

export const evaluateTool = {
  name: 'mloop_evaluate',
  description: 'Evaluate a model\'s performance on test data. Shows detailed metrics.',
  inputSchema: {
    type: 'object',
    properties: {
      projectPath: {
        type: 'string',
        description: 'Path to MLoop project directory',
      },
      dataFile: {
        type: 'string',
        description: 'Test data file for evaluation',
      },
      modelName: {
        type: 'string',
        description: 'Model name to evaluate',
      },
      experimentId: {
        type: 'string',
        description: 'Specific experiment ID to evaluate (otherwise uses production)',
      },
    },
    required: ['projectPath'],
  },
  handler: evaluate,
};

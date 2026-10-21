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
  sliceBy: z.string().optional().describe('Also report the metrics for each value of this column of the test data'),
  weight: z.string().optional().describe('Column that weights the test rows (defaults to the experiment\'s training weight when the file has it)'),
  against: z.string().optional().describe('Also evaluate this experiment id (or "production") on the same rows and weights, and compare the two row by row (mloop >= 0.39)'),
});

export type EvaluateParams = z.infer<typeof evaluateSchema>;

export async function evaluate(params: EvaluateParams): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  try {
    const { projectPath, dataFile, modelName, experimentId, sliceBy, weight, against } = params;

    // CLI usage: mloop evaluate [<experiment-id> [<test-data>]] [options]
    // Both experiment-id and test-data are positional arguments
    // Note: test-data can only be specified after experiment-id (positional order)
    // --json: the metrics, slices and comparison as one document, not the human tables.
    const args: string[] = ['evaluate'];

    if (experimentId) {
      args.push(experimentId);
      // test-data is only valid after experiment-id
      if (dataFile) {
        args.push(dataFile);
      }
    }
    // If only dataFile is given without experimentId, we cannot pass it as
    // the CLI requires experiment-id before test-data. In this case, the caller
    // should place the file at datasets/test.csv and omit dataFile, or provide
    // an experimentId.

    // Named option: --name
    if (modelName) {
      args.push('--name', modelName);
    }
    if (sliceBy) {
      args.push('--slice-by', sliceBy);
    }
    if (weight) {
      args.push('--weight', weight);
    }
    if (against) {
      args.push('--against', against);
    }
    args.push('--json');

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
  description: 'Evaluate a model\'s performance on test data, as JSON: test metrics beside the training metrics, per slice with sliceBy, weighted with weight. With against (an experiment id or "production"), the other model is scored on the same rows and weights and the two are compared row by row: comparison.metrics, and comparison.paired — the per-row loss (error_rate for a classifier, squared_error for a regressor) of each, their difference (candidate − baseline), a 95% paired bootstrap interval, and verdict CandidateBetter / BaselineBetter / Indistinguishable. Use it to decide whether a staging candidate should replace production.',
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
      sliceBy: {
        type: 'string',
        description: 'Also report the metrics for each value of this column (any column of the test file); slices under 30 rows are marked, more than 50 values is refused',
      },
      weight: {
        type: 'string',
        description: 'Column of the test file that weights its rows (e.g. 1/π of a recheck sample). A weighted experiment uses its training weight by default when the file has that column',
      },
      against: {
        type: 'string',
        description: 'Experiment id, or "production", to compare with on the same rows and weights (mloop >= 0.39)',
      },
    },
    required: ['projectPath'],
  },
  handler: evaluate,
};

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

    // The test data follows the experiment id, so a file for the production model needs that model's id: it is
    // read from `mloop list --json`, the CLI's own record of production, rather than the file being dropped.
    const target = experimentId ?? (dataFile ? await productionExperiment(projectPath, modelName) : undefined);
    if (dataFile && !target) {
      return {
        content: [{ type: 'text', text: `No production model for '${modelName ?? 'default'}' to evaluate on ${dataFile} — give experimentId, or promote one first.` }],
        isError: true,
      };
    }
    if (target) args.push(target);
    if (dataFile) args.push(dataFile);

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
  description: 'Evaluate a model\'s performance on test data, as JSON: test metrics beside the training metrics, per slice with sliceBy, weighted with weight. For a classifier, confusion: classes and counts[actual][predicted] (weighted sums under weight; per slice too) — read any class-set rate from it, e.g. the share of a must-catch class answered as a harmless one (mloop >= 0.39). With against (an experiment id or "production"), the other model is scored on the same rows and weights and the two are compared row by row: comparison.metrics, and comparison.paired — the per-row loss (error_rate for a classifier, squared_error for a regressor) of each, their difference (candidate − baseline), a 95% paired bootstrap interval, and verdict CandidateBetter / BaselineBetter / Indistinguishable. Use it to decide whether a staging candidate should replace production.',
  handler: evaluate,
};

/** The experiment in production for `modelName` (the default model when not given), or undefined. */
async function productionExperiment(projectPath: string, modelName: string | undefined): Promise<string | undefined> {
  const listed = await executeMloop(['list', '--json', ...(modelName ? ['--name', modelName] : [])], { cwd: projectPath });
  const production = (JSON.parse(listed.stdout) as { production?: Record<string, string | null> }).production ?? {};
  return production[modelName ?? 'default'] ?? undefined;
}

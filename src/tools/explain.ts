/**
 * mloop_explain tool - Which input columns a trained model relies on
 */

import { z } from 'zod';
import { executeMloop } from '../executor.js';
import { parseCliOutput } from '../utils/parser.js';
import { formatError } from '../utils/errors.js';

export const explainSchema = z.object({
  projectPath: z.string().describe('Path to MLoop project directory'),
  experimentId: z.string().optional().describe('Experiment to explain (default: the production model)'),
  modelName: z.string().optional().describe('Model name (default: "default")'),
  dataFile: z.string().optional().describe('Labeled file the model is scored on, with the label column (default: datasets/test.csv)'),
  weight: z.string().optional().describe('Column that weights the rows (defaults as mloop_evaluate does)'),
  repeats: z.number().int().positive().optional().describe('Shuffles per column; the importance is their mean (default 3)'),
  rows: z.number().int().positive().optional().describe('Most rows scored; a larger file is sampled — every column costs repeats scorings (default 2000)'),
  seed: z.number().int().optional().describe('Seed of the sample and the shuffles: the same seed gives the same numbers (default 1)'),
  records: z.string().optional().describe('For a JSON data file: the dotted path to the array whose items are the rows'),
});

export type ExplainParams = z.infer<typeof explainSchema>;

export async function explain(params: ExplainParams): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  try {
    const { projectPath, experimentId, modelName, dataFile, weight, repeats, rows, seed, records } = params;

    const args: string[] = ['explain'];
    if (experimentId) args.push(experimentId);
    if (modelName) args.push('--name', modelName);
    if (dataFile) args.push('--data', dataFile);
    if (weight) args.push('--weight', weight);
    if (repeats !== undefined) args.push('--repeats', String(repeats));
    if (rows !== undefined) args.push('--rows', String(rows));
    if (seed !== undefined) args.push('--seed', String(seed));
    if (records) args.push('--records', records);
    args.push('--json');

    const result = await executeMloop(args, { cwd: projectPath });

    return {
      content: [{ type: 'text', text: parseCliOutput(result.stdout) || 'No explanation output.' }],
    };
  } catch (error) {
    return {
      content: [{ type: 'text', text: formatError(error) }],
      isError: true,
    };
  }
}

export const explainTool = {
  name: 'mloop_explain',
  description: 'Which input columns a trained model relies on, as JSON: permutation importance on a labeled file, in the metric mloop_evaluate reports — each column is shuffled `repeats` times and the importance is the mean drop (± the spread), at most `rows` rows, seeded so the same seed gives the same numbers. A column the model did not read is listed as not shuffled. It is reliance, not cause: correlated columns share it. Defaults to the production model and datasets/test.csv (needs an mloop newer than 0.48).',
  handler: explain,
};

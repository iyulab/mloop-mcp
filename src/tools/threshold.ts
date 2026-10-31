/**
 * mloop_threshold tool - Choose, show or remove a binary classifier's decision threshold
 */

import { z } from 'zod';
import { executeMloop } from '../executor.js';
import { parseCliOutput } from '../utils/parser.js';
import { formatError } from '../utils/errors.js';

export const thresholdSchema = z.object({
  projectPath: z.string().describe('Path to MLoop project directory'),
  experimentId: z.string().optional().describe('Experiment to set the threshold of (default: the production model)'),
  modelName: z.string().optional().describe('Model name'),
  precision: z.number().optional().describe('Target positive precision (above 0, at most 1): the lowest threshold reaching it on dataFile is chosen'),
  precisionOf: z.string().optional().describe('The class whose precision is targeted, by its label value (default: the positive class) — the negative class too, when a wrong "no" is the costly answer'),
  guarantee: z.number().optional().describe('Risk δ, above 0 and below 1 (e.g. 0.05), with precision: choose the lowest threshold whose precision is certified to reach the target — wrong in at most δ of the files it could be run on — or refuse when the file cannot carry it (mloop >= 0.48)'),
  dataFile: z.string().optional().describe('Labeled evaluation file the threshold is chosen on (required with precision)'),
  weight: z.string().optional().describe('Column that weights the rows'),
  clear: z.boolean().optional().describe('Remove the threshold: the model answers at 0.5 again'),
  records: z.string().optional().describe('For a JSON dataFile: the dotted path to the array whose items are the rows'),
});

export type ThresholdParams = z.infer<typeof thresholdSchema>;

export async function threshold(params: ThresholdParams): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  try {
    const { projectPath, experimentId, modelName, precision, precisionOf, guarantee, dataFile, weight, clear, records } = params;

    const args: string[] = ['threshold'];
    if (experimentId) args.push(experimentId);
    if (modelName) args.push('--name', modelName);
    if (precision !== undefined) args.push('--precision', String(precision));
    if (precisionOf) args.push('--precision-of', precisionOf);
    if (guarantee !== undefined) args.push('--guarantee', String(guarantee));
    if (dataFile) args.push('--data', dataFile);
    if (weight) args.push('--weight', weight);
    if (records) args.push('--records', records);
    if (clear) args.push('--clear');
    args.push('--json');

    const result = await executeMloop(args, { cwd: projectPath });

    return {
      content: [{ type: 'text', text: parseCliOutput(result.stdout) || 'No threshold output.' }],
    };
  } catch (error) {
    return {
      content: [{ type: 'text', text: formatError(error) }],
      isError: true,
    };
  }
}

export const thresholdTool = {
  name: 'mloop_threshold',
  description: 'A binary classifier\'s decision threshold, as JSON. With precision and dataFile, chooses the probability threshold at which the precision of the positive class — or of precisionOf, the negative one included (mloop >= 0.40) — reaches the target on those labeled rows, keeping the most of that class\'s recall, and writes it beside the model — predict, serve, evaluate and the gate then answer at it, and promote carries it. With guarantee (a risk such as 0.05, mloop >= 0.48) the threshold is the lowest one whose precision is certified, not merely observed on the file — the usual choice is the luckiest reading of its rows, and on synthetic files its true precision fell below the target about half the time; a certified one needs enough rows (29 right answers for 0.90 at 0.05) and is refused, writing nothing, when the file cannot carry it. Without precision, shows the current one; with clear, removes it. Refused for a model that is not binary or gives no probability, or when no threshold reaches the precision (mloop >= 0.39).',
  handler: threshold,
};

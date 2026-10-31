/**
 * mloop_trigger tool - Check retraining triggers
 */

import { z } from 'zod';
import { executeMloop, buildArgsWithPositional } from '../executor.js';
import { parseCliOutput } from '../utils/parser.js';
import { formatError } from '../utils/errors.js';

export const triggerSchema = z.object({
  projectPath: z.string().describe('Path to MLoop project directory'),
  modelName: z.string().optional().describe('Model name (default: "default")'),
  accuracy: z.number().min(0).max(1).optional().describe('Accuracy threshold (0.0-1.0): the accuracy condition is met when feedback accuracy drops below it (default: the project\'s)'),
  feedback: z.number().int().nonnegative().optional().describe('Feedback volume threshold: the volume condition is met once this many feedback rows have come in (default: the project\'s)'),
});

export type TriggerParams = z.infer<typeof triggerSchema>;

export async function trigger(params: TriggerParams): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  try {
    const cliParams: Record<string, unknown> = {};
    if (params.modelName) cliParams['name'] = params.modelName;
    if (params.accuracy !== undefined) cliParams['accuracy'] = params.accuracy;
    if (params.feedback !== undefined) cliParams['feedback'] = params.feedback;
    cliParams['json'] = true;

    const args = buildArgsWithPositional('trigger', ['check'], cliParams);
    const result = await executeMloop(args, { cwd: params.projectPath });
    const output = parseCliOutput(result.stdout);

    return {
      content: [{
        type: 'text',
        text: output || 'No retraining triggers activated.',
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

export const triggerTool = {
  name: 'mloop_trigger',
  description: 'Check whether retraining is due, as JSON: each default condition — feedback accuracy (the production experiment\'s own answers, met once the drop is established: at least 30 rows of feedback and the 95% interval\'s upper end below the threshold), feedback volume, time since training and input drift (PSI of the production model\'s logged inputs against its training data, met at 0.25) — with its threshold, current value, whether it is met and why; the drift condition carries every column\'s PSI under drift. A condition that could not be measured says so in details.',
  handler: trigger,
};

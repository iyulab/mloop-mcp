/**
 * mloop_prep_plan tool - Declaratively edit prep steps in mloop.yaml (policy only).
 *
 * 1:1 bridge to the `mloop prep plan` CLI command. Records preprocessing decisions in
 * mloop.yaml without touching data — statistical fit still happens fold-internally at
 * train time. Returns a structured JSON envelope ({command, model, task, applied, prep,
 * warnings}) where each prep step reports its leakage category and fold-safety, so an
 * agent can decide whether a transform is safe before training.
 */

import { z } from 'zod';
import { executeMloop, buildArgsWithPositional } from '../executor.js';
import { parseCliOutput } from '../utils/parser.js';
import { formatError } from '../utils/errors.js';

export const prepPlanSchema = z.object({
  projectPath: z.string().describe('Path to the MLoop project directory'),
  set: z
    .string()
    .optional()
    .describe('Add/replace a prep step: "type[:method]" (e.g. "normalize:z-score", "drop-duplicates")'),
  columns: z
    .string()
    .optional()
    .describe('Comma-separated target columns for the --set/--remove step (e.g. "a,b")'),
  remove: z.string().optional().describe('Remove prep step(s) of this type'),
  modelName: z.string().optional().describe('Model name in mloop.yaml (default: "default")'),
});

export type PrepPlanParams = z.infer<typeof prepPlanSchema>;

export async function prepPlan(
  params: PrepPlanParams
): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  try {
    const { projectPath, set, columns, remove, modelName } = params;

    const cliParams: Record<string, unknown> = {};
    if (set) cliParams['set'] = set;
    if (columns) cliParams['columns'] = columns;
    if (remove) cliParams['remove'] = remove;
    if (modelName) cliParams['name'] = modelName;
    // Always emit the structured JSON envelope for LLM consumption.
    cliParams['json'] = true;

    const args = buildArgsWithPositional('prep', ['plan'], cliParams);
    const result = await executeMloop(args, { cwd: projectPath });
    const output = parseCliOutput(result.stdout);

    return {
      content: [{ type: 'text', text: output || 'Prep plan updated.' }],
    };
  } catch (error) {
    return {
      content: [{ type: 'text', text: formatError(error) }],
      isError: true,
    };
  }
}

export const prepPlanTool = {
  name: 'mloop_prep_plan',
  description:
    'Declare a preprocessing step in mloop.yaml (policy only — never changes data). ' +
    "Add/replace with set='type[:method]' (+ optional columns), remove with remove='type', " +
    'or omit both to list the current plan. Returns a JSON envelope where each step reports its ' +
    'leakage category (preFeaturizer/csvStage/unsupportedLeakageWarn) and fold-safety. ' +
    'Statistical fit happens fold-internally at train time.',
  inputSchema: {
    type: 'object',
    properties: {
      projectPath: {
        type: 'string',
        description: 'Path to the MLoop project directory',
      },
      set: {
        type: 'string',
        description: 'Add/replace a prep step: "type[:method]" (e.g. "normalize:z-score", "drop-duplicates")',
      },
      columns: {
        type: 'string',
        description: 'Comma-separated target columns for the set/remove step (e.g. "a,b")',
      },
      remove: {
        type: 'string',
        description: 'Remove prep step(s) of this type',
      },
      modelName: {
        type: 'string',
        description: 'Model name in mloop.yaml (default: "default")',
      },
    },
    required: ['projectPath'],
  },
  handler: prepPlan,
};

/**
 * mloop_features_select tool - Declare feature include/exclude in mloop.yaml (policy only).
 *
 * 1:1 bridge to the `mloop features select` CLI command. Edits column include/exclude via
 * ColumnOverride (Type:"ignore") without touching data. `keep` computes the complement
 * against the train-data header (the label is always kept). Returns a structured JSON
 * envelope ({command, model, applied, ignored, warnings}).
 */

import { z } from 'zod';
import { executeMloop, buildArgsWithPositional } from '../executor.js';
import { parseCliOutput } from '../utils/parser.js';
import { formatError } from '../utils/errors.js';

export const featuresSelectSchema = z.object({
  projectPath: z.string().describe('Path to the MLoop project directory'),
  drop: z.string().optional().describe('Comma-separated columns to exclude from features (e.g. "id,ts")'),
  keep: z
    .string()
    .optional()
    .describe('Comma-separated columns to keep; all other columns are excluded (label always kept)'),
  reset: z.boolean().optional().describe('Remove all "ignore" overrides (clears feature exclusions)'),
  modelName: z.string().optional().describe('Model name in mloop.yaml (default: "default")'),
});

export type FeaturesSelectParams = z.infer<typeof featuresSelectSchema>;

export async function featuresSelect(
  params: FeaturesSelectParams
): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  try {
    const { projectPath, drop, keep, reset, modelName } = params;

    const cliParams: Record<string, unknown> = {};
    if (drop) cliParams['drop'] = drop;
    if (keep) cliParams['keep'] = keep;
    if (reset) cliParams['reset'] = true;
    if (modelName) cliParams['name'] = modelName;
    // Always emit the structured JSON envelope for LLM consumption.
    cliParams['json'] = true;

    const args = buildArgsWithPositional('features', ['select'], cliParams);
    const result = await executeMloop(args, { cwd: projectPath });
    const output = parseCliOutput(result.stdout);

    return {
      content: [{ type: 'text', text: output || 'Feature selection updated.' }],
    };
  } catch (error) {
    return {
      content: [{ type: 'text', text: formatError(error) }],
      isError: true,
    };
  }
}

export const featuresSelectTool = {
  name: 'mloop_features_select',
  description:
    'Declare which columns are features in mloop.yaml (policy only — never changes data). ' +
    "Exclude columns with drop='a,b', keep only certain columns with keep='a,b' (all others " +
    'excluded, label always kept), or clear all exclusions with reset=true. Returns a JSON ' +
    'envelope listing the excluded (ignored) columns.',
  inputSchema: {
    type: 'object',
    properties: {
      projectPath: {
        type: 'string',
        description: 'Path to the MLoop project directory',
      },
      drop: {
        type: 'string',
        description: 'Comma-separated columns to exclude from features (e.g. "id,ts")',
      },
      keep: {
        type: 'string',
        description: 'Comma-separated columns to keep; all others excluded (label always kept)',
      },
      reset: {
        type: 'boolean',
        description: 'Remove all "ignore" overrides (clears feature exclusions)',
      },
      modelName: {
        type: 'string',
        description: 'Model name in mloop.yaml (default: "default")',
      },
    },
    required: ['projectPath'],
  },
  handler: featuresSelect,
};

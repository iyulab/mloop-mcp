/**
 * mloop_prep tool - Run preprocessing pipeline
 */

import { z } from 'zod';
import { executeMloop, buildArgsWithPositional } from '../executor.js';
import { parseCliOutput } from '../utils/parser.js';
import { formatError } from '../utils/errors.js';

export const prepSchema = z.object({
  projectPath: z.string().describe('Path to MLoop project directory'),
  modelName: z.string().optional().describe("Model whose prep steps (mloop.yaml) to run (default: 'default')"),
  input: z.string().optional().describe('Input CSV file (default: datasets/train.csv)'),
  output: z.string().optional().describe('Output CSV file (default: <input>_prep.csv)'),
  dryRun: z.boolean().optional().describe('Show the pipeline steps without executing them'),
});

export type PrepParams = z.infer<typeof prepSchema>;

export async function prep(params: PrepParams): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  try {
    const cliParams: Record<string, unknown> = {
      name: params.modelName,
      input: params.input,
      output: params.output,
      dryRun: params.dryRun,
      json: true,
    };

    const args = buildArgsWithPositional('prep', ['run'], cliParams);
    const result = await executeMloop(args, { cwd: params.projectPath });
    const output = parseCliOutput(result.stdout);

    return {
      content: [{
        type: 'text',
        text: output || 'Preprocessing completed successfully.',
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

export const prepTool = {
  name: 'mloop_prep',
  description: "Run a model's preprocessing pipeline — the prep steps declared under the model in mloop.yaml (see mloop_prep_plan) — over a CSV file, writing the prepared file.",
  inputSchema: {
    type: 'object',
    properties: {
      projectPath: {
        type: 'string',
        description: 'Path to MLoop project directory',
      },
      modelName: {
        type: 'string',
        description: "Model whose prep steps (mloop.yaml) to run (default: 'default')",
      },
      input: {
        type: 'string',
        description: 'Input CSV file (default: datasets/train.csv)',
      },
      output: {
        type: 'string',
        description: 'Output CSV file (default: <input>_prep.csv)',
      },
      dryRun: {
        type: 'boolean',
        description: 'Show the pipeline steps without executing them',
      },
    },
    required: ['projectPath'],
  },
  handler: prep,
};

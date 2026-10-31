/**
 * mloop_sample tool - Sample data from data files (CSV, TSV, JSON, Excel, Parquet) or prediction logs
 */

import { z } from 'zod';
import { executeMloop, buildArgsWithPositional } from '../executor.js';
import { parseCliOutput } from '../utils/parser.js';
import { formatError } from '../utils/errors.js';

export const sampleSchema = z.object({
  projectPath: z.string().describe('Path to MLoop project directory'),
  action: z.enum(['create', 'stats']).describe('Sample action to perform'),
  modelName: z.string().optional().describe(
    'Model whose logged predictions and feedback to sample ("create": a retraining dataset — the feedback under the model\'s label, weighted when feedback carries weights; "stats": default "default")'),
  dataFile: z.string().optional().describe('Data file to sample from instead of prediction logs — CSV, TSV, JSON, Excel or Parquet; the sample is written as CSV ("create" only)'),
  records: z.string().optional().describe('For a JSON data file: the dotted path to the array whose items are the rows ("create" only)'),
  size: z.number().int().positive().optional().describe('Number of rows to sample (default 1000)'),
  strategy: z.string().optional().describe(
    'Sampling strategy — logs: random, recent, feedback-priority, stratified, low-confidence; CSV: random, head, stratified'),
  label: z.string().optional().describe('Label column for stratified CSV sampling'),
  output: z.string().optional().describe('Output CSV path'),
});

export type SampleParams = z.infer<typeof sampleSchema>;

/** The CLI arguments for one call — the option names `mloop sample <action>` accepts. */
export function sampleArgs(params: SampleParams): string[] {
  const cliParams: Record<string, unknown> = {};
  if (params.action === 'create') {
    cliParams['from'] = params.dataFile;
    cliParams['records'] = params.dataFile ? params.records : undefined;
    cliParams['name'] = params.dataFile ? undefined : (params.modelName ?? 'default');
    cliParams['rows'] = params.size;
    cliParams['strategy'] = params.strategy;
    cliParams['label'] = params.label;
    cliParams['output'] = params.output;
  } else {
    cliParams['name'] = params.modelName;
  }
  cliParams['json'] = true;
  return buildArgsWithPositional('sample', [params.action], cliParams);
}

export async function sample(params: SampleParams): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  try {
    const result = await executeMloop(sampleArgs(params), { cwd: params.projectPath });
    const output = parseCliOutput(result.stdout);

    return {
      content: [{
        type: 'text',
        text: output || `Sample ${params.action} completed.`,
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

export const sampleTool = {
  name: 'mloop_sample',
  description: 'Create a sampled dataset — from a model\'s logged predictions and feedback (a retraining dataset: feedback under the model\'s label, with a weight column when feedback carries weights) or from a data file (CSV, TSV, JSON, Excel, Parquet; written as CSV) — or view sampling statistics.',
  handler: sample,
};

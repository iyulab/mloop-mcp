/**
 * mloop_feedback tool - Manage feedback for predictions
 */

import { z } from 'zod';
import { executeMloop, buildArgsWithPositional } from '../executor.js';
import { parseCliOutput } from '../utils/parser.js';
import { formatError } from '../utils/errors.js';

export const feedbackSchema = z.object({
  projectPath: z.string().describe('Path to MLoop project directory'),
  action: z.enum(['add', 'list', 'metrics']).describe('Feedback action to perform'),
  modelName: z.string().optional().describe('Model name for "list" and "metrics" (default: "default")'),
  predictionId: z.string().optional().describe('Prediction ID to add feedback for ("add" takes this and value, or file)'),
  value: z.string().optional().describe('The actual (ground-truth) value ("add" takes this and predictionId, or file)'),
  source: z.string().optional().describe('Where the value came from, e.g. "human", "reviewer-llm" (for "add"; with file, for the rows whose source cell is empty)'),
  weight: z.number().nonnegative().optional().describe(
    'How much this row counts in training and evaluation built from feedback — for a row reviewed with probability p, 1/p (for "add"; default 1; with file, for the rows whose weight cell is empty)'),
  file: z.string().optional().describe(
    'For "add": a table (CSV, TSV, workbook, …) with one row per prediction — its prediction id and the actual value in columns — to record many at once instead of predictionId and value. ' +
    'Rows that cannot be recorded come back by row number; the others are recorded. Needs an mloop that has `feedback add --from-file`.'),
  idColumn: z.string().optional().describe('With file: the column holding the prediction id (default "prediction_id")'),
  actualColumn: z.string().optional().describe('With file: the column holding the actual value (default "actual")'),
  sourceColumn: z.string().optional().describe('With file: the column holding where each value came from (default "source", read when the file has it)'),
  weightColumn: z.string().optional().describe('With file: the column holding each row\'s weight (default "weight", read when the file has it)'),
  limit: z.number().int().positive().optional().describe('Maximum number of entries to show (for "list"; default 20)'),
  experiment: z.string().optional().describe(
    'For "metrics": whose answers the metrics are of — an experiment id, or "all" for every experiment\'s. Default: the experiment in production, the answers `mloop_trigger` judges; with nothing promoted, every answer. ' +
    'Needs an mloop that has `feedback metrics --experiment`.'),
  from: z.string().optional().describe('Only entries from this day on (yyyy-MM-dd; for "list" and "metrics")'),
  to: z.string().optional().describe('Only entries up to this day (yyyy-MM-dd; for "list" and "metrics")'),
});

export type FeedbackParams = z.infer<typeof feedbackSchema>;

/** The CLI arguments for one call — the option names `mloop feedback <action>` accepts. */
export function feedbackArgs(params: FeedbackParams): string[] {
  const cliParams: Record<string, unknown> = {};
  if (params.action === 'add') {
    if (params.file !== undefined) {
      cliParams['from-file'] = params.file;
      cliParams['id-column'] = params.idColumn;
      cliParams['actual-column'] = params.actualColumn;
      cliParams['source-column'] = params.sourceColumn;
      cliParams['weight-column'] = params.weightColumn;
    } else {
      cliParams['prediction-id'] = params.predictionId;
      cliParams['actual-value'] = params.value;
    }
    cliParams['source'] = params.source;
    cliParams['weight'] = params.weight;
  } else {
    cliParams['name'] = params.modelName;
    if (params.action === 'list') cliParams['limit'] = params.limit;
    if (params.action === 'metrics') cliParams['experiment'] = params.experiment;
    cliParams['from'] = params.from;
    cliParams['to'] = params.to;
  }
  cliParams['json'] = true;
  return buildArgsWithPositional('feedback', [params.action], cliParams);
}

/** Why an "add" call cannot be made, or undefined when it can: one prediction (predictionId and value) or a file of them, never both. */
export function addRefusal(params: FeedbackParams): string | undefined {
  if (params.action !== 'add') return undefined;
  const columns = params.idColumn !== undefined || params.actualColumn !== undefined
    || params.sourceColumn !== undefined || params.weightColumn !== undefined;
  if (params.file !== undefined) {
    return params.predictionId !== undefined || params.value !== undefined
      ? '"add" takes predictionId and value for one prediction, or file for many — not both.'
      : undefined;
  }
  if (columns) return 'idColumn, actualColumn, sourceColumn and weightColumn name columns of a file — give file, or drop them.';
  if (!params.predictionId || params.value === undefined) {
    return '"add" needs predictionId and value (the prediction ID from mloop_logs, and the actual value), or file for many predictions at once.';
  }
  return undefined;
}

export async function feedback(params: FeedbackParams): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  try {
    const refusal = addRefusal(params);
    if (refusal) {
      return { content: [{ type: 'text', text: refusal }], isError: true };
    }

    const result = await executeMloop(feedbackArgs(params), { cwd: params.projectPath });
    const output = parseCliOutput(result.stdout);

    return {
      content: [{
        type: 'text',
        text: output || `Feedback ${params.action} completed.`,
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

export const feedbackTool = {
  name: 'mloop_feedback',
  description: 'Manage feedback for model predictions. Add the actual value for a logged prediction (with its source and an optional weight) — or for many at once from a table with one row per prediction (`file`; rows that cannot be recorded are listed by row number, the others are recorded), list existing feedback, or view feedback metrics (accuracy is weighted when feedback carries weights).',
  handler: feedback,
};

/**
 * mloop_train tool - Train ML models with AutoML
 */

import { z } from 'zod';
import type { ServerContext } from '@modelcontextprotocol/server';
import { buildArgsWithPositional } from '../executor.js';
import { runTraining } from '../training-run.js';
import { taskSchema } from '../tasks.js';

export const trainSchema = z.object({
  projectPath: z.string().describe('Path to MLoop project directory'),
  dataFile: z.string().optional().describe('Training data file (default: datasets/train.csv)'),
  label: z.string().optional().describe('Label column name'),
  task: taskSchema
    .optional()
    .describe('ML task type (default: the project\'s, from mloop.yaml)'),
  time: z.number().positive().optional().describe('Training time in seconds'),
  maxTrials: z.number().int().positive().optional().describe('Stop the trainer search after this many trials, within time — the same search on a fast machine and a slow one. Tasks that run no search (clustering, anomaly detection, recommendation, forecasting, deep learning) refuse it'),
  epochs: z.number().int().positive().optional().describe('Epochs a deep-learning task trains for (default 10): text classification, sentence similarity, NER, question answering, object detection. `time` does not shorten such a fit, so this is its one dial on cost — try 2 first to see what an epoch costs. Other tasks refuse it'),
  metric: z.string().optional().describe('Optimization metric'),
  modelName: z.string().optional().describe('Model name (default: "default")'),
  balance: z.string().optional().describe('Class balancing strategy for classification (image classification included — it oversamples its training split): "auto" (balance to 10:1), "none", or target ratio (e.g., "5" for 5:1)'),
  testSplit: z.number().min(0).max(1).optional().describe('Test data split ratio (0.0-1.0, default: 0.2)'),
  noPromote: z.boolean().optional().describe('Skip automatic promotion to production'),
  dropMissingLabels: z.boolean().optional().describe('Drop rows with missing label values before training'),
  weight: z.string().optional().describe('Column that weights the rows (e.g. 1/π for sampled labels); never a feature'),
  additionalDataFiles: z.array(z.string()).optional().describe(
    'Files merged after dataFile (e.g. a retraining set from mloop_sample create); a file without the weight column counts its rows 1'),
  portable: z.boolean().optional().describe('Train only with steps ONNX can express, so mloop_export_onnx can export the model'),
  groupColumn: z.string().optional().describe('Ranking: the column that groups rows into query contexts'),
  encoder: z.string().optional().describe('image-anomaly: the installed image encoder the pictures are embedded with (default: the only one installed — see mloop_encoder)'),
  bankSize: z.number().int().positive().optional().describe('image-anomaly: the most patches the bank holds; a limit keeps a coreset of the patches (default: every patch)'),
  maxRows: z.number().int().positive().optional().describe('Most training rows; more are sampled'),
  samplingStrategy: z.enum(['random', 'stratified']).optional().describe('How rows are sampled when maxRows applies (default: by task)'),
  seed: z.number().int().optional().describe('Random seed for the sampling (default: 42)'),
  records: z.string().optional().describe('For a JSON data file: the dotted path to the array whose items are the rows'),
  analyzeData: z.boolean().optional().describe('Check the data quality and train nothing: the answer carries `analysis` (each finding with a suggested fix; an empty list when there are none) instead of a result'),
  generateScript: z.string().optional().describe('Write a preprocessing script from the data check to this path. With analyzeData the run stops there (the answer carries `script`); without it, it goes on to train'),
  autoMerge: z.boolean().optional().describe('Detect and merge the CSV files of the same schema in datasets/ into the training data'),
  autoTime: z.boolean().optional().describe('true: size the time budget from the data even when mloop.yaml sets one; false: no estimation, the 300 s default budget; leave out: the run decides (a given `time` always wins)'),
});

export type TrainParams = z.infer<typeof trainSchema>;

export async function train(params: TrainParams, ctx?: ServerContext): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  try {
    const { projectPath, dataFile, label, ...options } = params;

    // Build positional arguments
    // More than one file goes through --data, which merges them; one file is the positional argument.
    const more = options.additionalDataFiles ?? [];
    const positional: string[] = [];
    if (dataFile && more.length === 0) positional.push(dataFile);

    // Map parameters to CLI flags
    const cliParams: Record<string, unknown> = {};
    if (label) cliParams['label'] = label;
    if (options.task) cliParams['task'] = options.task;
    if (options.time) cliParams['time'] = options.time;
    if (options.maxTrials) cliParams['max-trials'] = options.maxTrials;
    if (options.epochs) cliParams['epochs'] = options.epochs;
    if (options.metric) cliParams['metric'] = options.metric;
    if (options.modelName) cliParams['name'] = options.modelName;
    if (options.balance) cliParams['balance'] = options.balance;
    if (options.testSplit !== undefined) cliParams['test-split'] = options.testSplit;
    if (options.noPromote) cliParams['no-promote'] = true;
    if (options.dropMissingLabels) cliParams['drop-missing-labels'] = true;
    if (options.weight) cliParams['weight'] = options.weight;
    if (options.portable) cliParams['portable'] = true;
    if (options.groupColumn) cliParams['group-column'] = options.groupColumn;
    if (options.encoder) cliParams['encoder'] = options.encoder;
    if (options.bankSize) cliParams['bank-size'] = options.bankSize;
    if (options.maxRows) cliParams['max-rows'] = options.maxRows;
    if (options.samplingStrategy) cliParams['sampling-strategy'] = options.samplingStrategy;
    if (options.seed !== undefined) cliParams['seed'] = options.seed;
    if (options.records) cliParams['records'] = options.records;
    if (options.analyzeData) cliParams['analyze-data'] = true;
    if (options.generateScript) cliParams['generate-script'] = options.generateScript;
    if (options.autoMerge) cliParams['auto-merge'] = true;
    if (options.autoTime === true) cliParams['auto-time'] = true;
    if (options.autoTime === false) cliParams['no-auto-time'] = true;

    const args = buildArgsWithPositional('train', positional, cliParams);
    if (more.length > 0) args.push('--data', dataFile ?? 'datasets/train.csv', ...more);

    const outcome = await runTraining(args, projectPath, options.time, ctx);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(outcome, null, 2),
      }],
    };
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: error instanceof Error ? error.message : String(error),
      }],
      isError: true,
    };
  }
}

export const trainTool = {
  name: 'mloop_train',
  description: 'Train an ML model using AutoML. Runs mloop train command with specified parameters. Answers the run\'s result (experiment id, trainer, metrics, promotion) and warnings as JSON; reports progress per trial when the call carries a progress token; cancelling the call stops the run. Without time, the run sizes its own budget from the data.',
  handler: train,
};

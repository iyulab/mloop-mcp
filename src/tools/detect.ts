/**
 * mloop_detect tool - One-shot time-series anomaly detection (no training required)
 */

import { z } from 'zod';
import { executeMloop, buildArgsWithPositional } from '../executor.js';
import { parseCliOutput } from '../utils/parser.js';
import { formatError } from '../utils/errors.js';
import * as path from 'node:path';

export const detectSchema = z.object({
  dataPath: z.string().describe('Path to the CSV file containing the time series'),
  column: z.string().optional().describe('Value column to monitor (auto-selected when the CSV has a single column)'),
  threshold: z.number().positive().optional().describe("Score above which a point is an anomaly (> 0; the score is a point's saliency relative to the points before it; default 3)"),
  sensitivity: z.number().gt(0).lt(100).optional().describe('Coverage of the control limits in percent (0-100, exclusive; 99.73 = 3 sigma; default 99.73)'),
  output: z.string().optional().describe('Also write the full per-point result to this CSV file'),
});

export type DetectParams = z.infer<typeof detectSchema>;

export async function detect(params: DetectParams): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  try {
    const { dataPath, column, threshold, sensitivity, output } = params;

    const cliParams: Record<string, unknown> = {};
    if (column) cliParams['column'] = column;
    if (threshold !== undefined) cliParams['threshold'] = threshold;
    if (sensitivity !== undefined) cliParams['sensitivity'] = sensitivity;
    if (output) cliParams['output'] = output;
    cliParams['json'] = true;

    const args = buildArgsWithPositional('detect', [dataPath], cliParams);

    // detect works on any CSV — no MLoop project required, so cwd is just the data's directory.
    const result = await executeMloop(args, {
      cwd: path.dirname(path.resolve(dataPath)),
    });

    const outputText = parseCliOutput(result.stdout);

    return {
      content: [{
        type: 'text',
        text: outputText || 'No detection output.',
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

export const detectTool = {
  name: 'mloop_detect',
  description: 'One-shot time-series anomaly detection over an entire CSV series (spectral residual, no training, no MLoop project required). Every point returns an anomaly verdict (isAnomaly), its score, an expectedValue and control limits (controlLower/controlUpper — the chartable band normal points lie inside); nearEdge marks points too close to the end of the series to judge as surely. Use this instead of train+predict when analyzing a whole series once.',
  handler: detect,
};

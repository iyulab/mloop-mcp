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
  threshold: z.number().optional().describe('Anomaly decision threshold in [0, 1] (default 0.3)'),
  sensitivity: z.number().optional().describe('Boundary sensitivity in [0, 100] — larger = tighter bounds (default 99)'),
  period: z.number().optional().describe('Seasonality period in points (default: auto-detect; 0 = non-seasonal)'),
  output: z.string().optional().describe('Also write the full per-point result to this CSV file'),
});

export type DetectParams = z.infer<typeof detectSchema>;

export async function detect(params: DetectParams): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  try {
    const { dataPath, column, threshold, sensitivity, period, output } = params;

    const cliParams: Record<string, unknown> = {};
    if (column) cliParams['column'] = column;
    if (threshold !== undefined) cliParams['threshold'] = threshold;
    if (sensitivity !== undefined) cliParams['sensitivity'] = sensitivity;
    if (period !== undefined) cliParams['period'] = period;
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
  description: 'One-shot time-series anomaly detection over an entire CSV series (SR-CNN, no training, no MLoop project required). Every point returns an anomaly verdict, score, and SPC-chart bounds (expectedValue/upperBound/lowerBound). Use this instead of train+predict when analyzing a whole series once.',
  inputSchema: {
    type: 'object',
    properties: {
      dataPath: {
        type: 'string',
        description: 'Path to the CSV file containing the time series',
      },
      column: {
        type: 'string',
        description: 'Value column to monitor (auto-selected when the CSV has a single column)',
      },
      threshold: {
        type: 'number',
        description: 'Anomaly decision threshold in [0, 1] (default 0.3)',
      },
      sensitivity: {
        type: 'number',
        description: 'Boundary sensitivity in [0, 100] — larger = tighter bounds (default 99)',
      },
      period: {
        type: 'number',
        description: 'Seasonality period in points (default: auto-detect; 0 = non-seasonal)',
      },
      output: {
        type: 'string',
        description: 'Also write the full per-point result to this CSV file',
      },
    },
    required: ['dataPath'],
  },
  handler: detect,
};

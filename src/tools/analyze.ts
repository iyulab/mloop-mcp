/**
 * mloop_analyze tool - Granular, read-only EDA aspects for feature-engineering decisions.
 *
 * 1:1 bridge to the `mloop analyze <aspect>` CLI command group. Each aspect is computed
 * in isolation and returned as a structured JSON envelope ({aspect, available, summary,
 * data, flags}) so an agent/LLM can read one analysis dimension at a time. Read-only:
 * never mutates the data file or mloop.yaml.
 */

import { z } from 'zod';
import { executeMloop, buildArgsWithPositional } from '../executor.js';
import { parseCliOutput } from '../utils/parser.js';
import { formatError } from '../utils/errors.js';

export const analyzeSchema = z.object({
  aspect: z
    .enum(['profile', 'correlation', 'importance', 'outliers', 'distribution', 'series'])
    .describe(
      'EDA aspect to compute: "profile" (column types, null %, cardinality, constant columns), ' +
        '"correlation" (high-correlation pairs + multicollinearity), ' +
        '"importance" (feature-importance ranking, requires a label), ' +
        '"outliers" (count/rate/isolation-forest threshold), ' +
        '"distribution" (skewness/kurtosis/normality tests), ' +
        '"series" (one column read as an ordered series: autocorrelation/partial autocorrelation with their bands, ' +
        'ADF and KPSS stationarity tests read together, dominant period; needs mloop 0.48 or later)'
    ),
  dataFile: z
    .string()
    .optional()
    .describe(
      "Path to the CSV dataset to analyze. Optional: when omitted, defaults to the project's " +
        'configured train data (data.train in mloop.yaml, else datasets/train.csv). Pass projectPath ' +
        'so the default can be resolved.'
    ),
  projectPath: z.string().optional().describe('MLoop project path (for resolving relative paths and the default data file)'),
  label: z
    .string()
    .optional()
    .describe('Label/target column name (overrides mloop.yaml; required for the "importance" aspect)'),
  column: z
    .string()
    .optional()
    .describe('Series column to analyze (only the "series" aspect; optional when the CSV has a single column)'),
  maxLag: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('Largest lag of the autocorrelation functions (only "series"; default min(10*log10 n, n - 1))'),
  aroundTrend: z
    .boolean()
    .optional()
    .describe('Test stationarity around a linear trend instead of a constant level (only "series")'),
  modelName: z
    .string()
    .optional()
    .describe('Model name to read label configuration from mloop.yaml (default: "default")'),
});

export type AnalyzeParams = z.infer<typeof analyzeSchema>;

export async function analyze(
  params: AnalyzeParams
): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  try {
    const { aspect, dataFile, projectPath, label, modelName, column, maxLag, aroundTrend } = params;

    const cliParams: Record<string, unknown> = {};
    if (aspect === 'series') {
      // A series has no label and no model: its options are the column and the two test choices.
      if (column) cliParams['column'] = column;
      if (maxLag !== undefined) cliParams['maxLag'] = maxLag;
      if (aroundTrend) cliParams['aroundTrend'] = true;
    } else {
      if (label) cliParams['label'] = label;
      if (modelName) cliParams['name'] = modelName;
    }
    // Always emit the structured JSON envelope for LLM consumption.
    cliParams['json'] = true;

    // dataFile is optional: when omitted, the CLI defaults to the project's configured train data.
    const positional = dataFile ? [aspect, dataFile] : [aspect];
    const args = buildArgsWithPositional('analyze', positional, cliParams);

    const result = await executeMloop(args, {
      cwd: projectPath,
    });

    const output = parseCliOutput(result.stdout);

    return {
      content: [
        {
          type: 'text',
          text: output || `No ${aspect} analysis available.`,
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: formatError(error),
        },
      ],
      isError: true,
    };
  }
}

export const analyzeTool = {
  name: 'mloop_analyze',
  description:
    'Run a single, read-only exploratory-data-analysis (EDA) aspect on a dataset and return a ' +
    'structured JSON envelope for feature-engineering decisions. Aspects: profile, correlation, ' +
    'importance (needs a label), outliers, distribution, series (a column as an ordered series). Never mutates the data file or mloop.yaml.',
  handler: analyze,
};

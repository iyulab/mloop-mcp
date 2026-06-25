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
    .enum(['profile', 'correlation', 'importance', 'outliers', 'distribution'])
    .describe(
      'EDA aspect to compute: "profile" (column types, null %, cardinality, constant columns), ' +
        '"correlation" (high-correlation pairs + multicollinearity), ' +
        '"importance" (feature-importance ranking, requires a label), ' +
        '"outliers" (count/rate/isolation-forest threshold), ' +
        '"distribution" (skewness/kurtosis/normality tests)'
    ),
  dataFile: z.string().describe('Path to the CSV dataset to analyze'),
  projectPath: z.string().optional().describe('MLoop project path (for resolving relative paths)'),
  label: z
    .string()
    .optional()
    .describe('Label/target column name (overrides mloop.yaml; required for the "importance" aspect)'),
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
    const { aspect, dataFile, projectPath, label, modelName } = params;

    const cliParams: Record<string, unknown> = {};
    if (label) cliParams['label'] = label;
    if (modelName) cliParams['name'] = modelName;
    // Always emit the structured JSON envelope for LLM consumption.
    cliParams['json'] = true;

    const args = buildArgsWithPositional('analyze', [aspect, dataFile], cliParams);

    const result = await executeMloop(args, {
      cwd: projectPath,
      timeout: 600_000, // 10 minutes: importance/distribution can run statistical analysis
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
    'importance (needs a label), outliers, distribution. Never mutates the data file or mloop.yaml.',
  inputSchema: {
    type: 'object',
    properties: {
      aspect: {
        type: 'string',
        enum: ['profile', 'correlation', 'importance', 'outliers', 'distribution'],
        description:
          'EDA aspect: "profile" (types/null%/cardinality/constant), "correlation" (high-correlation pairs + multicollinearity), "importance" (feature ranking, requires a label), "outliers" (count/rate/isolation-forest threshold), "distribution" (skewness/kurtosis/normality).',
      },
      dataFile: {
        type: 'string',
        description: 'Path to the CSV dataset to analyze',
      },
      projectPath: {
        type: 'string',
        description: 'MLoop project path for resolving relative paths',
      },
      label: {
        type: 'string',
        description: 'Label/target column name (overrides mloop.yaml; required for the "importance" aspect)',
      },
      modelName: {
        type: 'string',
        description: 'Model name to read label configuration from mloop.yaml (default: "default")',
      },
    },
    required: ['aspect', 'dataFile'],
  },
  handler: analyze,
};

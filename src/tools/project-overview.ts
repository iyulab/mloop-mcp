/**
 * mloop_project_overview tool - Comprehensive project status in a single call
 */

import { z } from 'zod';
import { executeMloop, buildArgs } from '../executor.js';
import { parseCliOutput } from '../utils/parser.js';
import { formatError } from '../utils/errors.js';

export const projectOverviewSchema = z.object({
  projectPath: z.string().describe('Project directory path'),
  modelName: z.string().optional().describe('Model name (default: "default")'),
});

export type ProjectOverviewParams = z.infer<typeof projectOverviewSchema>;

export async function projectOverview(params: ProjectOverviewParams): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  try {
    const nameOpts: Record<string, unknown> = {};
    if (params.modelName) nameOpts['name'] = params.modelName;

    // Run status and list in parallel
    const [statusResult, listResult] = await Promise.all([
      executeMloop(['status'], { cwd: params.projectPath })
        .catch(e => ({ stdout: formatError(e), stderr: '', exitCode: 1 })),
      executeMloop(buildArgs('list', nameOpts), { cwd: params.projectPath })
        .catch(e => ({ stdout: formatError(e), stderr: '', exitCode: 1 })),
    ]);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          summary: 'Project overview',
          status: parseCliOutput(statusResult.stdout),
          experiments: parseCliOutput(listResult.stdout),
        }, null, 2),
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

export const projectOverviewTool = {
  name: 'mloop_project_overview',
  description: 'Get a comprehensive overview of the MLoop project: status, all experiments, and production model metrics in a single call.',
  inputSchema: {
    type: 'object',
    properties: {
      projectPath: {
        type: 'string',
        description: 'Project directory path',
      },
      modelName: {
        type: 'string',
        description: 'Model name (default: "default")',
      },
    },
    required: ['projectPath'],
  },
  handler: projectOverview,
};

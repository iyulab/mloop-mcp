/**
 * mloop_rollback tool - Return production to the experiment it held before
 */

import { z } from 'zod';
import { executeMloop } from '../executor.js';
import { parseCliOutput } from '../utils/parser.js';
import { formatError } from '../utils/errors.js';

export const rollbackSchema = z.object({
  projectPath: z.string().describe('Path to MLoop project directory'),
  modelName: z.string().optional().describe('Model name'),
  to: z.string().optional().describe('Experiment to return to; it must have been in production before (default: the one the current production replaced)'),
});

export type RollbackParams = z.infer<typeof rollbackSchema>;

export async function rollback(params: RollbackParams): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  try {
    const { projectPath, modelName, to } = params;

    const args: string[] = ['rollback'];
    if (modelName) args.push('--name', modelName);
    if (to) args.push('--to', to);
    args.push('--json');

    const result = await executeMloop(args, { cwd: projectPath });

    return {
      content: [{ type: 'text', text: parseCliOutput(result.stdout) || 'Production rolled back.' }],
    };
  } catch (error) {
    return {
      content: [{ type: 'text', text: formatError(error) }],
      isError: true,
    };
  }
}

export const rollbackTool = {
  name: 'mloop_rollback',
  description: 'Return production to the experiment it held before the current one (from the promotion history), backing up the current production first. With "to", return to a named experiment that has been production before; an experiment that never served is refused — use mloop_promote for that.',
  handler: rollback,
};

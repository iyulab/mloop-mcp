/**
 * mloop_runtime tool - List, install or remove the on-demand deep-learning runtimes
 */

import { z } from 'zod';
import { executeMloop } from '../executor.js';
import { parseCliOutput } from '../utils/parser.js';
import { formatError } from '../utils/errors.js';

export const runtimeSchema = z.object({
  projectPath: z.string().describe('Working directory (runtimes are kept per user, not per project)'),
  action: z.enum(['list', 'install', 'remove']).describe('list the runtimes and whether each is installed, install one, or remove an installed one'),
  runtime: z.enum(['tf', 'torch', 'onnxruntime']).optional().describe('The runtime to install or remove: tf (image classification), torch (text tasks), onnxruntime (ONNX export check, image encoders)'),
});

export type RuntimeParams = z.infer<typeof runtimeSchema>;

export async function runtime(params: RuntimeParams): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  const { projectPath, action, runtime: name } = params;
  if (action !== 'list' && !name) {
    return { content: [{ type: 'text', text: `Name the runtime to ${action}: tf, torch or onnxruntime.` }], isError: true };
  }

  try {
    // Only list has --json; install and remove answer in a line of text. install is told to be quiet: there is nobody to prompt.
    const args: string[] = action === 'list'
      ? ['runtime', 'list', '--json']
      : action === 'install'
        ? ['runtime', 'install', name!, '--quiet']
        : ['runtime', 'remove', name!];

    const result = await executeMloop(args, { cwd: projectPath });

    return {
      content: [{ type: 'text', text: parseCliOutput(result.stdout) || (action === 'list' ? 'No runtime information.' : `Runtime '${name}' ${action === 'install' ? 'installed' : 'removed'}.`) }],
    };
  } catch (error) {
    return {
      content: [{ type: 'text', text: formatError(error) }],
      isError: true,
    };
  }
}

export const runtimeTool = {
  name: 'mloop_runtime',
  description: 'Manage the deep-learning runtimes mloop downloads on demand: list them with their install state, install one (tf for image classification, torch for text tasks, onnxruntime for the ONNX export check and image encoders — a large download), or remove it. A task whose runtime is missing refuses to train and names the runtime to install.',
  handler: runtime,
};

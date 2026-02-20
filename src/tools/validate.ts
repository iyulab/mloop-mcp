/**
 * mloop_validate tool - Validate mloop.yaml configuration
 */

import { z } from 'zod';
import { executeMloop } from '../executor.js';
import { parseCliOutput } from '../utils/parser.js';
import { formatError } from '../utils/errors.js';

export const validateSchema = z.object({
  projectPath: z.string().describe('Path to MLoop project directory'),
});

export type ValidateParams = z.infer<typeof validateSchema>;

export async function validate(params: ValidateParams): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  try {
    const args: string[] = ['validate'];
    const result = await executeMloop(args, { cwd: params.projectPath });
    const output = parseCliOutput(result.stdout);

    return {
      content: [{
        type: 'text',
        text: output || 'Configuration is valid.',
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

export const validateTool = {
  name: 'mloop_validate',
  description: 'Validate the mloop.yaml configuration file. Checks for syntax errors, missing fields, and invalid values.',
  inputSchema: {
    type: 'object',
    properties: {
      projectPath: {
        type: 'string',
        description: 'Path to MLoop project directory',
      },
    },
    required: ['projectPath'],
  },
  handler: validate,
};

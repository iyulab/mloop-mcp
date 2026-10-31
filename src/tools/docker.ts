/**
 * mloop_docker tool - Generate the Docker configuration that serves a model
 */

import { z } from 'zod';
import { executeMloop } from '../executor.js';
import { parseCliOutput } from '../utils/parser.js';
import { formatError } from '../utils/errors.js';

export const dockerSchema = z.object({
  projectPath: z.string().describe('Path to MLoop project directory (the files are written here)'),
  modelName: z.string().optional().describe('Model to containerize (default: "default")'),
  port: z.number().int().positive().max(65535).optional().describe('Port the API is exposed on (default 5000)'),
});

export type DockerParams = z.infer<typeof dockerSchema>;

export async function docker(params: DockerParams): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  try {
    const { projectPath, modelName, port } = params;

    const args: string[] = ['docker'];
    if (modelName) args.push('--name', modelName);
    if (port !== undefined) args.push('--port', String(port));

    const result = await executeMloop(args, { cwd: projectPath });

    return {
      content: [{ type: 'text', text: parseCliOutput(result.stdout) || 'Docker files generated.' }],
    };
  } catch (error) {
    return {
      content: [{ type: 'text', text: formatError(error) }],
      isError: true,
    };
  }
}

export const dockerTool = {
  name: 'mloop_docker',
  description: 'Generate the Docker configuration that serves a project\'s model with `mloop serve` (a Dockerfile and a docker-compose.yml, whose compose service mounts the project\'s models read-only and needs a JWT_SIGNING_KEY of 32+ characters to start) into the project directory. Files already there are overwritten. Answers the console text: this command has no JSON output.',
  handler: docker,
};

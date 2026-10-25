/**
 * mloop_token tool - Issue a JWT bearer token for the local serve API
 */

import { z } from 'zod';
import { executeMloop } from '../executor.js';
import { formatError, stripAnsi } from '../utils/errors.js';

export const tokenSchema = z.object({
  projectPath: z.string().describe('Path to MLoop project directory'),
  role: z.enum(['admin']).optional()
    .describe('admin for the write endpoints (POST /promote, /rollback, /train, /evaluate, /samples, cache); omit for predict and reads'),
  subject: z.string().optional().describe('Who the token identifies (the sub claim); the request limit counts per subject (default: mloop-cli)'),
  expiresHours: z.number().positive().optional().describe('Token lifetime in hours (default: 24)'),
  key: z.string().min(32).optional()
    .describe("The server's signing key (Jwt:Key), when it is not the development key — at least 32 characters"),
});

export type TokenParams = z.infer<typeof tokenSchema>;

export async function token(params: TokenParams): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  try {
    const { projectPath, role, subject, expiresHours, key } = params;

    const args: string[] = ['token', '--quiet'];
    if (role) args.push('--role', role);
    if (subject) args.push('--subject', subject);
    if (expiresHours) args.push('--expires-hours', String(expiresHours));
    if (key) args.push('--key', key);

    const result = await executeMloop(args, { cwd: projectPath });
    const issued = stripAnsi(result.stdout).trim();

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ token: issued, header: `Authorization: Bearer ${issued}` }, null, 2),
      }],
    };
  } catch (error) {
    return {
      content: [{ type: 'text', text: formatError(error) }],
      isError: true,
    };
  }
}

export const tokenTool = {
  name: 'mloop_token',
  description: 'Issue a JWT bearer token for a server started with mloop_serve: every endpoint but /health requires one, sent as the returned Authorization header. Signed with the development key unless key is given; role admin for the write endpoints.',
  handler: token,
};

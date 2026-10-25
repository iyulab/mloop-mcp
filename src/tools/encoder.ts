/**
 * mloop_encoder tool - List, install or remove pretrained encoders
 */

import { z } from 'zod';
import { executeMloop } from '../executor.js';
import { parseCliOutput } from '../utils/parser.js';
import { formatError } from '../utils/errors.js';

export const encoderSchema = z.object({
  projectPath: z.string().describe('Working directory (encoders are kept per user, not per project)'),
  action: z.enum(['list', 'install', 'remove']).describe('list the installed encoders, install one from the catalog, or remove one'),
  encoder: z.string().optional().describe('The encoder id — for install, a catalog id (dinov2-small for images, multilingual-minilm for text)'),
});

export type EncoderParams = z.infer<typeof encoderSchema>;

export async function encoder(params: EncoderParams): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  const { projectPath, action, encoder: id } = params;
  if (action !== 'list' && !id) {
    return { content: [{ type: 'text', text: `Name the encoder to ${action}.` }], isError: true };
  }

  try {
    // remove has no --json: its answer is a confirmation line.
    const args: string[] = action === 'list'
      ? ['encoder', 'list', '--json']
      : action === 'install'
        ? ['encoder', 'install', id!, '--json']
        : ['encoder', 'remove', id!];

    const result = await executeMloop(args, { cwd: projectPath });

    return {
      content: [{ type: 'text', text: parseCliOutput(result.stdout) || `Encoder '${id}' removed.` }],
    };
  } catch (error) {
    return {
      content: [{ type: 'text', text: formatError(error) }],
      isError: true,
    };
  }
}

export const encoderTool = {
  name: 'mloop_encoder',
  description: 'Manage the pretrained encoders mloop_embed and encoder-read text columns run: list the installed ones, install a catalog encoder (its weights are downloaded and checked against a pinned SHA-256 — dinov2-small ~88 MB, multilingual-minilm ~470 MB), or remove one.',
  handler: encoder,
};

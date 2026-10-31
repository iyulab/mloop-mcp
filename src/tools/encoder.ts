/**
 * mloop_encoder tool - List, install, add or remove pretrained encoders
 */

import { z } from 'zod';
import { executeMloop } from '../executor.js';
import { parseCliOutput } from '../utils/parser.js';
import { formatError } from '../utils/errors.js';

export const encoderSchema = z.object({
  projectPath: z.string().describe('Working directory (encoders are kept per user, not per project)'),
  action: z.enum(['list', 'install', 'add', 'remove']).describe('list the installed encoders, install one from the catalog, add one of your own from its files, or remove one'),
  encoder: z.string().optional().describe('The encoder id — for install, a catalog id (dinov2-small for images, multilingual-minilm for text); for remove, an installed one'),
  definition: z.string().optional().describe('add: the encoder\'s definition file (encoder.json)'),
  model: z.string().optional().describe('add: the encoder\'s ONNX graph'),
  tokenizer: z.string().optional().describe('add, a text encoder: its tokenizer model (SentencePiece .model)'),
});

export type EncoderParams = z.infer<typeof encoderSchema>;

export async function encoder(params: EncoderParams): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  const { projectPath, action, encoder: id, definition, model, tokenizer } = params;
  if (action === 'add') {
    if (!definition || !model)
      return { content: [{ type: 'text', text: '"add" needs definition (the encoder.json) and model (its ONNX graph).' }], isError: true };
  } else if (action !== 'list' && !id) {
    return { content: [{ type: 'text', text: `Name the encoder to ${action}.` }], isError: true };
  }

  try {
    // add and remove have no --json: their answer is a confirmation line.
    const args: string[] = action === 'list'
      ? ['encoder', 'list', '--json']
      : action === 'install'
        ? ['encoder', 'install', id!, '--json']
        : action === 'add'
          ? ['encoder', 'add', definition!, '--model', model!, ...(tokenizer ? ['--tokenizer', tokenizer] : [])]
          : ['encoder', 'remove', id!];

    const result = await executeMloop(args, { cwd: projectPath });

    return {
      content: [{ type: 'text', text: parseCliOutput(result.stdout) || (action === 'add' ? 'Encoder added.' : `Encoder '${id}' removed.`) }],
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
  description: 'Manage the pretrained encoders mloop_embed and encoder-read text columns run: list the installed ones, install a catalog encoder (its weights are downloaded and checked against a pinned SHA-256 — dinov2-small ~88 MB, multilingual-minilm ~470 MB), add one of your own from its definition file and ONNX graph (and tokenizer, for a text encoder), or remove one.',
  handler: encoder,
};

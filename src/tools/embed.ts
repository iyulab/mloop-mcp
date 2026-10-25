/**
 * mloop_embed tool - Images or texts to vectors with a pretrained encoder
 */

import { z } from 'zod';
import { executeMloop } from '../executor.js';
import { parseCliOutput } from '../utils/parser.js';
import { formatError } from '../utils/errors.js';

export const embedSchema = z.object({
  projectPath: z.string().describe('Working directory the paths are relative to (an MLoop project is not required)'),
  images: z.array(z.string()).max(64).optional().describe('Image files (PNG, JPEG, …) to embed, at most 64'),
  texts: z.array(z.string()).max(256).optional().describe('Texts to embed with a text encoder, at most 256 — instead of images'),
  encoder: z.string().optional().describe('The encoder to use (mloop_encoder list); may be left out when only one of the kind is installed'),
  patches: z.boolean().optional().describe('Also one vector per patch of each image, on the encoder\'s grid (images only, at most 8)'),
});

export type EmbedParams = z.infer<typeof embedSchema>;

export async function embed(params: EmbedParams): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  const { projectPath, images = [], texts = [], encoder, patches } = params;
  if ((images.length === 0) === (texts.length === 0)) {
    return {
      content: [{ type: 'text', text: 'Give either images or texts to embed (one of the two, not both).' }],
      isError: true,
    };
  }

  try {
    const args: string[] = ['embed', ...images];
    for (const text of texts) args.push('--text', text);
    if (encoder) args.push('--encoder', encoder);
    if (patches) args.push('--patches');
    args.push('--json');

    const result = await executeMloop(args, { cwd: projectPath });

    return {
      content: [{ type: 'text', text: parseCliOutput(result.stdout) }],
    };
  } catch (error) {
    return {
      content: [{ type: 'text', text: formatError(error) }],
      isError: true,
    };
  }
}

export const embedTool = {
  name: 'mloop_embed',
  description: 'Turn images or texts into L2-normalised vectors with a pretrained encoder (mloop_encoder installs one), with the encoder\'s identity — id, sha256, preprocessor — so vectors from different encoders or versions are never compared. Texts need mloop 0.46.0 or later.',
  handler: embed,
};

/**
 * mloop_export_onnx tool - Write a trained model as an ONNX graph with a manifest
 */

import { z } from 'zod';
import { executeMloop } from '../executor.js';
import { parseCliOutput } from '../utils/parser.js';
import { formatError } from '../utils/errors.js';

export const exportOnnxSchema = z.object({
  projectPath: z.string().describe('Path to MLoop project directory'),
  experimentId: z.string().optional().describe('Experiment to export (default: the production model)'),
  modelName: z.string().optional().describe('Model name'),
  dataFile: z.string().optional().describe("A data file with the model's input columns (default: the experiment's training file)"),
  outputDir: z.string().optional().describe("Directory for model.onnx and model.onnx.json (default: the experiment's directory)"),
  verify: z.boolean().optional().describe('Run the graph in ONNX Runtime and compare it with the model; a graph that disagrees is not kept'),
  annotations: z.record(z.string(), z.string()).optional().describe("Opaque text pairs written into the manifest's `annotations` (at most 32; keys up to 64 and values up to 1,024 characters) — for example the version of the preprocessing that feeds the graph. mloop does not read them; a hash or signature over the manifest covers them. Needs an `mloop` that has `--annotation`"),
});

export type ExportOnnxParams = z.infer<typeof exportOnnxSchema>;

/** The `mloop export onnx` command line for the call (the project is the working directory, not an argument). */
export function exportOnnxArgs(params: ExportOnnxParams): string[] {
  const { experimentId, modelName, dataFile, outputDir, verify, annotations } = params;

  const args: string[] = ['export', 'onnx'];
  if (experimentId) args.push(experimentId);
  if (modelName) args.push('--name', modelName);
  if (dataFile) args.push('--data', dataFile);
  if (outputDir) args.push('--output', outputDir);
  if (verify) args.push('--verify');
  for (const [key, value] of Object.entries(annotations ?? {})) args.push('--annotation', `${key}=${value}`);
  args.push('--json');
  return args;
}

export async function exportOnnx(params: ExportOnnxParams): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  try {
    const { projectPath } = params;
    const args = exportOnnxArgs(params);

    const result = await executeMloop(args, { cwd: projectPath });

    return {
      content: [{ type: 'text', text: parseCliOutput(result.stdout) || 'Exported.' }],
    };
  } catch (error) {
    return {
      content: [{ type: 'text', text: formatError(error) }],
      isError: true,
    };
  }
}

export const exportOnnxTool = {
  name: 'mloop_export_onnx',
  description: 'Write a trained model (binary, multiclass or regression) as an ONNX graph plus a manifest (model.onnx.json) naming each graph input and the data columns behind it, the outputs, the classes, the metrics and SHA-256 hashes — for runtimes without ML.NET. A model that featurizes a free-text column with the ML.NET text featurizer is refused with the columns named — train it with `portable: true` (mloop_train) to export it; a category column exports as is.',
  handler: exportOnnx,
};

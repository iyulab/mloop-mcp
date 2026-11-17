// `mloop_export_onnx` passes the call to `mloop export onnx` and asks for its JSON; the manifest's `annotations` go through
// `--annotation key=value`, one flag per pair — the CLI splits at the first '=', so a value may hold one.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { exportOnnxArgs } from '../build/tools/export-onnx.js';

test('a bare call exports the production model as JSON', () => {
  assert.deepEqual(exportOnnxArgs({ projectPath: '/tmp/p' }), ['export', 'onnx', '--json']);
});

test('annotations become one --annotation key=value per pair, a value may hold an equals sign', () => {
  const args = exportOnnxArgs({ projectPath: '/tmp/p', experimentId: 'exp-004', annotations: { prep: 'v2', build: 'a=b' } });
  assert.deepEqual(args, ['export', 'onnx', 'exp-004', '--annotation', 'prep=v2', '--annotation', 'build=a=b', '--json']);
});

test('the other options keep their flags', () => {
  const args = exportOnnxArgs({ projectPath: '/tmp/p', modelName: 'm', dataFile: 'd.csv', outputDir: 'out', verify: true });
  assert.deepEqual(args, ['export', 'onnx', '--name', 'm', '--data', 'd.csv', '--output', 'out', '--verify', '--json']);
});

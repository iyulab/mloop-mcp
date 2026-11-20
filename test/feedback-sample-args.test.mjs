// `mloop_feedback` and `mloop_sample` name a model with `--name` (the CLI's one spelling since 0.47) and ask for the
// command's JSON — the console text of these commands is prose an agent would have to scrape.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { feedbackArgs, addRefusal } from '../build/tools/feedback.js';
import { sampleArgs } from '../build/tools/sample.js';

const project = '/tmp/p';

test('feedback list and metrics name the model with --name and ask for JSON', () => {
  for (const action of ['list', 'metrics']) {
    const args = feedbackArgs({ projectPath: project, action, modelName: 'm' });
    assert.deepEqual(args.slice(0, 2), ['feedback', action]);
    assert.ok(args.includes('--name') && args[args.indexOf('--name') + 1] === 'm', args.join(' '));
    assert.ok(args.includes('--json'), args.join(' '));
    assert.ok(!args.includes('--model'), args.join(' '));
  }
});

test('feedback list carries limit and the day range; metrics carries the range but no limit', () => {
  const range = { from: '2026-10-01', to: '2026-10-31' };
  const list = feedbackArgs({ projectPath: project, action: 'list', limit: 5, ...range });
  assert.ok(list.includes('--limit') && list[list.indexOf('--limit') + 1] === '5', list.join(' '));
  assert.ok(list[list.indexOf('--from') + 1] === range.from && list[list.indexOf('--to') + 1] === range.to, list.join(' '));
  const metrics = feedbackArgs({ projectPath: project, action: 'metrics', limit: 5, ...range });
  assert.ok(metrics.includes('--from') && metrics.includes('--to') && !metrics.includes('--limit'), metrics.join(' '));
});

test('feedback metrics carries the experiment whose answers it reads, and list and add do not', () => {
  const metrics = feedbackArgs({ projectPath: project, action: 'metrics', modelName: 'm', experiment: 'exp-002' });
  assert.ok(metrics.includes('--experiment') && metrics[metrics.indexOf('--experiment') + 1] === 'exp-002', metrics.join(' '));
  const every = feedbackArgs({ projectPath: project, action: 'metrics', experiment: 'all' });
  assert.equal(every[every.indexOf('--experiment') + 1], 'all');
  assert.ok(!feedbackArgs({ projectPath: project, action: 'metrics' }).includes('--experiment'), 'an unset experiment is not passed — the CLI default is the production experiment');
  assert.ok(!feedbackArgs({ projectPath: project, action: 'list', experiment: 'exp-002' }).includes('--experiment'));
});

test('feedback add asks for JSON and carries the weight', () => {
  const args = feedbackArgs({ projectPath: project, action: 'add', predictionId: 'p1', value: 'yes', source: 'human', weight: 2 });
  assert.ok(args.includes('--json') && args.includes('--prediction-id') && args.includes('--weight'), args.join(' '));
});

test('feedback add from a file passes the file and its columns, not one prediction', () => {
  const args = feedbackArgs({
    projectPath: project, action: 'add', file: 'labels.csv', idColumn: 'ticket', actualColumn: 'verdict',
    sourceColumn: 'how', weightColumn: 'w', source: 'reviewer-llm', weight: 2,
  });
  const at = (flag) => args[args.indexOf(flag) + 1];
  assert.deepEqual(args.slice(0, 2), ['feedback', 'add']);
  assert.equal(at('--from-file'), 'labels.csv');
  assert.equal(at('--id-column'), 'ticket');
  assert.equal(at('--actual-column'), 'verdict');
  assert.equal(at('--source-column'), 'how');
  assert.equal(at('--weight-column'), 'w');
  assert.equal(at('--source'), 'reviewer-llm');
  assert.equal(at('--weight'), '2');
  assert.ok(args.includes('--json') && !args.includes('--prediction-id') && !args.includes('--actual-value'), args.join(' '));
});

test('feedback add takes one prediction or a file, and names what is missing', () => {
  const base = { projectPath: project, action: 'add' };
  assert.equal(addRefusal({ ...base, predictionId: 'p1', value: 'yes' }), undefined);
  assert.equal(addRefusal({ ...base, file: 'labels.csv' }), undefined);
  assert.match(addRefusal({ ...base, file: 'labels.csv', predictionId: 'p1' }), /not both/);
  assert.match(addRefusal({ ...base, predictionId: 'p1' }), /predictionId and value.*or file/);
  assert.match(addRefusal({ ...base, predictionId: 'p1', value: 'yes', idColumn: 'ticket' }), /give file/);
  assert.equal(addRefusal({ projectPath: project, action: 'list' }), undefined);
});

test('sample create from logs names the model with --name, from a file does not name one; both ask for JSON', () => {
  const logs = sampleArgs({ projectPath: project, action: 'create', modelName: 'm' });
  assert.ok(logs.includes('--name') && !logs.includes('--model') && logs.includes('--json'), logs.join(' '));
  const file = sampleArgs({ projectPath: project, action: 'create', dataFile: 'a.csv' });
  assert.ok(file.includes('--from') && !file.includes('--name') && file.includes('--json'), file.join(' '));
});

test('sample create from a JSON file carries the array of rows; from logs it does not', () => {
  const json = sampleArgs({ projectPath: project, action: 'create', dataFile: 'a.json', records: 'data.rows' });
  assert.deepEqual(json.slice(json.indexOf('--records'), json.indexOf('--records') + 2), ['--records', 'data.rows'], json.join(' '));
  const logs = sampleArgs({ projectPath: project, action: 'create', modelName: 'm', records: 'data.rows' });
  assert.ok(!logs.includes('--records'), logs.join(' '));
});

test('sample stats names the model with --name and asks for JSON', () => {
  const args = sampleArgs({ projectPath: project, action: 'stats', modelName: 'm' });
  assert.ok(args.includes('--name') && args.includes('--json') && !args.includes('--model'), args.join(' '));
});

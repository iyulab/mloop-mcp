/**
 * The ML task types `mloop` knows (`mloop init --help`). One list for every tool that takes a `task`: a tool with its own
 * shorter copy is a CLI an agent can only partly drive. `scripts/check-cli-options.mjs` compares this list with the
 * installed CLI's.
 */

import { z } from 'zod';

export const MLOOP_TASKS = [
  'regression',
  'binary-classification',
  'multiclass-classification',
  'anomaly-detection',
  'clustering',
  'ranking',
  'forecasting',
  'time-series-anomaly',
  'image-classification',
  'object-detection',
  'image-anomaly',
  'text-classification',
  'sentence-similarity',
  'ner',
  'question-answering',
  'recommendation',
] as const;

export const taskSchema = z.enum(MLOOP_TASKS);

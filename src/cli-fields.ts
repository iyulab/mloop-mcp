/**
 * The fields of `mloop`'s JSON output this server reads by name.
 *
 * Most tools hand the CLI's answer on as it is; these are the places where the code looks inside it. A field the CLI
 * renames would not fail here — it would read as missing (`'unknown'` for an experiment id, a run that never reports its
 * promotion) — so every read goes through `read`, which accepts only a field declared below, and
 * `scripts/check-cli-output.mjs` runs the real CLI and checks that each declared field is in what it prints. A new read
 * is a new line here first; the compiler refuses one that is not.
 *
 * Keys are the kind of answer: `train#<event>` for one kind of event of `mloop train --json` (one JSON object a line,
 * its `event` field naming the kind), `train` for the stream itself, and the command's name for a single document.
 */
export const CONSUMED = {
  /** Every line of the stream: the field that says what kind of event it is. */
  train: ['event'],
  'train#phase': ['phase'],
  'train#trial': ['metric', 'trainer', 'value'],
  'train#warning': ['message'],
  'train#error': ['message'],
  'train#result': ['experimentId'],
  'train#promotion': ['promoted'],
  /** `production` maps a model name to the experiment in production (or null). */
  list: ['production'],
} as const;

export type AnswerKind = keyof typeof CONSUMED;

/** The value of a declared field of an answer (undefined when the answer has none, or is not there). */
export function read<K extends AnswerKind>(
  answer: object | null | undefined,
  _kind: K,
  field: (typeof CONSUMED)[K][number],
): unknown {
  return answer === null || answer === undefined ? undefined : (answer as Record<string, unknown>)[field];
}

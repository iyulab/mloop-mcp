# Changelog

All notable changes to `@iyulab/mloop-mcp` are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).
Releases before 0.11.3 are described by their commits. 0.12.0 includes the 0.11.3 fix.

## [Unreleased]

### Added

- `mloop_train` takes `epochs`, passed as `mloop train --epochs`: how many epochs a deep-learning task (text classification, sentence similarity, NER,
  question answering, object detection) trains for. `time` does not shorten such a fit, so the epoch count is its one dial on cost - try 2 first to see
  what an epoch costs on the machine. Needs an `mloop` that has the flag; a task that does not count epochs refuses it.

## [0.14.0] - 2026-10-30

### Added

- `mloop_train` takes `maxTrials`, passed as `mloop train --max-trials`: the trainer search stops after that many trials within `time`, so the
  same call trains the same search on a fast machine and a slow one. Needs an `mloop` that has the flag; a task that runs no search refuses it.
- `mloop_init`, `mloop_train` and `mloop_quick_start` take every task the `mloop` CLI has — all sixteen, where they listed three
  (`regression` and the two classification tasks) and an agent could not start a forecasting, clustering, image or text project.
  The list is one module (`src/tasks.ts`); `npm run check:cli` now also compares it with `mloop init --help` and reports a task the
  tools lack or one the CLI does not know.
- `mloop_train` passes `groupColumn` (ranking), `encoder` and `bankSize` (image-anomaly), `maxRows`, `samplingStrategy`, `seed` and
  `records` (a JSON data file's row path) to the matching `mloop train` options.
  `encoder`, `bankSize` and the `image-anomaly` task need `mloop` 0.47 or later.
- `mloop_evaluate` takes `normalClass` (the subfolder of normal pictures for an image-anomaly model) and `records`; `mloop_predict` takes `records` and
  `includeFeatures` (false leaves the input columns out of the output file).

- `mloop_analyze` takes the `series` aspect with `column`, `maxLag` and `aroundTrend`: one column read as an ordered series, answered as the
  autocorrelation and partial autocorrelation functions with their bands, the ADF and KPSS stationarity tests read together, and the
  dominant period. It needs `mloop` 0.48 or later. A label and a model name are not used by this aspect and are not passed.
- Every tool now carries the four MCP safety hints (`readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`), so a client's
  approval policy can read what a tool may do instead of guessing from its name. Twelve tools only read (`mloop_list`, `mloop_status`,
  `mloop_info`, `mloop_analyze`, `mloop_compare`, `mloop_evaluate`, `mloop_validate`, `mloop_logs`, `mloop_trigger`, `mloop_drift`,
  `mloop_embed`, `mloop_project_overview`) and so does `mloop_token`; the rest write, and those that can overwrite a file at a path
  the caller names or delete a setting, a threshold or an installed encoder say `destructiveHint: true`. The hints live in one table
  (`src/tool-hints.ts`) and the server refuses to start with a tool that has none.
- The repository and the package carry a `LICENSE` file (MIT, as `package.json` already declared).
- `mloop_threshold` takes `guarantee`, a risk such as 0.05 used with `precision`: the threshold is then the lowest one whose
  precision is certified to reach the target (wrong in at most that share of the files it could be run on) instead of the lowest
  one that reached it on the file, and the command refuses, writing nothing, when the file has too few rows to carry the
  guarantee. It needs `mloop` 0.48 or later.

### Changed

- `mloop_quick_start`'s `label` is optional (omit it for a task that learns without one) and its `dataFile` may be a folder of pictures.

## [0.13.0] - 2026-10-27

`mloop_feedback`, `mloop_sample`, `mloop_init` and `mloop_quick_start` need `mloop` 0.47 or later; the other tools
work with `mloop` 0.40 or later as before.

### Changed

- **Breaking for a server run against an older `mloop`:** `mloop_feedback` (list, metrics) and `mloop_sample` name the
  model with `--name` — the CLI's spelling for a model name since 0.47, where `--model` now means a model file — and
  ask for `--json`.
- `mloop_init`, `mloop_feedback` (add) and `mloop_sample` (create) answer the command's JSON (`--json`, new in `mloop`
  0.47) instead of its console text, as every other tool does; `mloop_quick_start` initialises through the same JSON.

## [0.12.0] - 2026-10-26

Every tool works with `mloop` 0.40 or later; `mloop_train`, `mloop_auto_train` and `mloop_quick_start` report
whether the experiment was promoted with `mloop` 0.46.0 or later.

### Added

- `mloop_token` issues the bearer token a server started with `mloop_serve` requires on every endpoint but
  `/health`; `mloop_embed` turns images or texts into vectors with the encoder's identity; `mloop_encoder` lists,
  installs and removes the pretrained encoders.
- The server speaks both MCP protocol eras over stdio: a client opening with `initialize` (2025-11-25 and earlier)
  and a 2026-07-28 client opening with `server/discover` (MCP TypeScript SDK v2).
- `mloop_train`, `mloop_auto_train` and `mloop_quick_start` report progress: a call that carries a progress token
  gets a notification for each phase and, at most once a second, for the trial just finished, with the time so far
  and the budget.
- Cancelling a tool call stops the command it runs — the whole process group, so a cancelled training run does not
  keep going in the background.

### Changed

- `mloop_train` answers the run's own result as JSON — `result` (experiment id, trainer, metrics, the model and
  report paths), `promotion` (`promoted`, `keptInStagingReason`) and `warnings` — instead of its console text, and a
  failed run answers the run's error messages. `mloop_auto_train` and `mloop_quick_start` carry the same in their
  answers; `mloop_quick_start` no longer reads the experiment id and promotion out of the console text.
- `mloop_compare`, `mloop_info`, `mloop_logs`, `mloop_status`, `mloop_validate`, `mloop_project_overview` and
  `mloop_auto_train`'s experiment list answer the command's JSON (`--json`) instead of console tables. A command
  that fails with a structured answer — `mloop_validate` on an invalid `mloop.yaml` — returns that JSON as the error.
- No tool has a fixed wall-clock limit any more: commands whose duration follows the data (predict, evaluate,
  analyze, info) were stopped after 5 or 10 minutes. A command is now stopped when its call is cancelled or when it
  writes nothing for 20 minutes; a training run with `time` also when it runs well past its budget (the budget plus
  10 minutes, or half again for budgets over 20 minutes). `executeMloop` has no default `timeout`, and takes
  `idleTimeout`, `signal` and `onStdoutLine`.
- Built with TypeScript 7.

### Fixed

- `mloop_evaluate` given a test file without an experiment dropped the file — the CLI takes it only after an
  experiment id — and evaluated on `datasets/test.csv` or failed. It now evaluates production on that file.
- `mloop_train` and `mloop_auto_train` stopped a run after 10 and 20 minutes whatever its `time`, so a run asked
  for an hour was killed a sixth of the way in.
- `mloop_serve` answered that the server was running in the background after its 5-second timeout — which is what
  stopped it. It now starts the server detached, waits for `/health`, and returns the URL, process id, log file and
  the command that stops it; a server that exits first, or does not answer within a minute, is an error carrying its
  output.

### Removed

- The hand-written JSON Schema copies (`*InputSchema`) and the `allTools` list exported from `./tools`: the server
  registers the zod schemas, and `tools/list` is unchanged. Import the `*Schema` zod objects instead.

## [0.11.3] - 2026-10-25

### Security

- Tool arguments reached the CLI through a shell, with only values containing a space quoted: a quote, `$(…)`, a
  backtick or a semicolon in any value a caller passed — a file name, a label, a text — ran as a shell command with
  the server's privileges. The CLI is now started without a shell, with its arguments passed as given. Every release
  before 0.11.3 is affected; 0.11.3 is 0.11.2 with this fix (and the lockfile's patched body-parser).

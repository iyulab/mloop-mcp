# mloop-mcp

MCP (Model Context Protocol) server for [MLoop](https://github.com/iyulab/MLoop) CLI.

Enables AI clients (Claude, Cursor, ironhive-cli) to perform MLOps tasks using MLoop's AutoML capabilities.

## Installation

```bash
npm install -g @iyulab/mloop-mcp
```

Or run directly with npx:

```bash
npx @iyulab/mloop-mcp
```

The server speaks MCP over stdio in both protocol eras: a client opening with `initialize` (2025-11-25 and
earlier) and a 2026-07-28 client opening with `server/discover`.

## Prerequisites

- Node.js 22+
- MLoop CLI 0.40 or later, installed and available in PATH (0.46.0 or later for the training tools to report
  whether the experiment was promoted)
  ```bash
  dotnet tool install -g mloop
  ```

### Custom MLoop Path

If MLoop is not in PATH, set the `MLOOP_PATH` environment variable:

```bash
# Windows
set MLOOP_PATH=%USERPROFILE%\tools\mloop.exe

# Linux/macOS
export MLOOP_PATH=/usr/local/bin/mloop
```

## Configuration

### For Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "mloop": {
      "command": "npx",
      "args": ["@iyulab/mloop-mcp"]
    }
  }
}
```

### For ironhive-cli

Add to `.ironhive/plugins.yaml`:

```yaml
plugins:
  mloop:
    transport: stdio
    command: npx
    args:
      - "@iyulab/mloop-mcp"
```

## Available Tools

| Tool | Description |
|------|-------------|
| `mloop_train` | Train ML models using AutoML |
| `mloop_predict` | Run predictions with trained models |
| `mloop_list` | List experiments and their metrics (structured JSON) |
| `mloop_promote` | Promote an experiment to production (explicit ID, `latest`, or `best`); a model the quality gate refuses needs `force`; `history` lists every change of production with the gate outcome (mloop >= 0.39) |
| `mloop_rollback` | Return production to the experiment it held before (or `to` a former production experiment) |
| `mloop_threshold` | Choose a binary model's decision threshold for a target precision on labeled rows, show it, or clear it (mloop >= 0.39) |
| `mloop_calibrate` | Fit a classifier's probability calibration (binary platt · isotonic, multiclass temperature) on labeled rows without retraining, show it, or clear it (mloop >= 0.40) |
| `mloop_export_onnx` | Model as ONNX + manifest (inputs and their data columns, outputs, classes, hashes) for runtimes without ML.NET |
| `mloop_info` | Analyze and profile datasets |
| `mloop_analyze` | Run one read-only EDA aspect (profile/correlation/importance/outliers/distribution) as structured JSON |
| `mloop_drift` | Recent inputs and answers vs the training data — PSI per column, for the answers (mloop >= 0.39), for free-text columns by length and unseen words (mloop >= 0.40), per slice, as JSON (mloop >= 0.38) |
| `mloop_detect` | One-shot time-series anomaly detection with SPC bounds — no training, no project required (mloop >= 0.21) |
| `mloop_prep_plan` | Declare a preprocessing step in mloop.yaml (policy only, no data change) as structured JSON |
| `mloop_features_select` | Declare feature include/exclude in mloop.yaml (policy only, no data change) as structured JSON |
| `mloop_status` | Show project status |
| `mloop_compare` | Compare multiple experiments |
| `mloop_evaluate` | Evaluate model performance as JSON; with `against`, compare two models row by row on the same rows (mloop >= 0.39) |
| `mloop_serve` | Start the REST API server; returns once it answers `/health`, and leaves it running |
| `mloop_token` | Issue the bearer token the server requires on every endpoint but `/health` (`role: admin` for writes) |
| `mloop_embed` | Images or texts to vectors with a pretrained encoder, with the encoder's identity (texts: mloop >= 0.46) |
| `mloop_encoder` | List, install (catalog: `dinov2-small`, `multilingual-minilm`) or remove pretrained encoders |

## Tool Examples

### Train a model

```json
{
  "tool": "mloop_train",
  "arguments": {
    "projectPath": "/path/to/project",
    "dataFile": "datasets/train.csv",
    "label": "target",
    "task": "binary-classification",
    "time": 60
  }
}
```

The answer is the run's own result as JSON — `result` (experiment id, trainer, metrics, where the model and its
report are) and the `warnings` the run raised. A call that carries a progress token gets a progress notification for
each phase and, at most once a second, for the trial just finished (`trial 12: FastForest r_squared 0.8828 · 4.1 s of a
60 s budget`). Cancelling the call stops the training process. A run with `time` is stopped well past its budget
(the budget plus 10 minutes, or half again for budgets over 20 minutes); one without `time` sizes its own budget, so
it is stopped only when it writes nothing for 20 minutes. `mloop_auto_train` and `mloop_quick_start` train the same
way, and the answer carries `promotion` — whether the experiment went to production, and why not (`mloop` 0.46.0
and later).

Every other tool runs its command with no wall-clock limit (how long it takes follows the data) and stops it when
the call is cancelled or the command writes nothing for 20 minutes. `mloop_serve` returns once the server answers
`/health` and leaves it running, naming its URL, process id, log file and the command that stops it.

Tools answer the CLI's own JSON (`--json`) wherever the command has it — `mloop_list`, `mloop_compare`,
`mloop_info`, `mloop_status`, `mloop_validate`, `mloop_logs` and the rest — so an agent reads fields rather than
console tables. A command that fails with a structured answer (an invalid `mloop.yaml`, say) returns that JSON
as the error.

### Run predictions

```json
{
  "tool": "mloop_predict",
  "arguments": {
    "projectPath": "/path/to/project",
    "dataFile": "datasets/test.csv",
    "output": "predictions/output.csv"
  }
}
```

### List experiments

```json
{
  "tool": "mloop_list",
  "arguments": {
    "projectPath": "/path/to/project",
    "showAll": true
  }
}
```

### Promote to production

```json
{
  "tool": "mloop_promote",
  "arguments": {
    "projectPath": "/path/to/project",
    "experimentId": "exp-003",
    "force": true
  }
}
```

### Analyze dataset

```json
{
  "tool": "mloop_info",
  "arguments": {
    "dataFile": "datasets/train.csv",
    "projectPath": "/path/to/project"
  }
}
```

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run locally
npm start

# Test with MCP Inspector
npx @modelcontextprotocol/inspector node build/index.js

# Run the tests (builds first; starts the server over stdio)
npm test

# Check that every tool passes the CLI only options it has (needs the mloop CLI; pass its path if not on PATH)
npm run check:cli -- /path/to/mloop
```

`check:cli` calls each tool with its schema filled in against a stand-in that records the command line, then compares
every option and argument with the real CLI's `--help`. Run it before a release and whenever a tool or the CLI's
options change — a tool passing an option the CLI does not have fails only when an agent calls it.

## Architecture

```
ironhive-cli ──[MCP/STDIO]──> mloop-mcp ──[subprocess]──> mloop CLI ──> ML.NET
```

- **Pure Bridge Pattern**: 1:1 CLI mapping, no business logic, stateless
- **STDIO Transport**: Simple process communication
- **Subprocess Execution**: Each tool call spawns `mloop` CLI

## License

MIT

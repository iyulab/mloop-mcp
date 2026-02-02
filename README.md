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

## Prerequisites

- Node.js 18+
- MLoop CLI installed and available in PATH
  ```bash
  dotnet tool install -g mloop
  ```

### Custom MLoop Path

If MLoop is not in PATH, set the `MLOOP_PATH` environment variable:

```bash
# Windows
set MLOOP_PATH=D:\lib\mloop.exe

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
| `mloop_list` | List experiments and their metrics |
| `mloop_promote` | Promote an experiment to production |
| `mloop_info` | Analyze and profile datasets |
| `mloop_status` | Show project status |
| `mloop_compare` | Compare multiple experiments |
| `mloop_evaluate` | Evaluate model performance |
| `mloop_serve` | Start REST API server |

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
```

## Architecture

```
ironhive-cli ──[MCP/STDIO]──> mloop-mcp ──[subprocess]──> mloop CLI ──> ML.NET
```

- **Pure Bridge Pattern**: 1:1 CLI mapping, no business logic, stateless
- **STDIO Transport**: Simple process communication
- **Subprocess Execution**: Each tool call spawns `mloop` CLI

## License

MIT

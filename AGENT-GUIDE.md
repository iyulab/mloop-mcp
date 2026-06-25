# MLoop MCP — Agent Guide

## Quick Reference

| Tool | Purpose | Key Params |
|------|---------|------------|
| `mloop_quick_start` | Zero to production in one call | `projectPath, dataFile, label, task` |
| `mloop_auto_train` | Retrain with auto-time | `projectPath, dataFile?` |
| `mloop_project_overview` | Full project status | `projectPath` |
| `mloop_init` | Initialize project | `projectPath, task` |
| `mloop_info` | Profile dataset | `dataFile, projectPath?` |
| `mloop_analyze` | One read-only EDA aspect as JSON | `aspect, dataFile, label?` |
| `mloop_train` | Train model | `projectPath, dataFile?, label?, time?` |
| `mloop_predict` | Run predictions | `projectPath, dataFile?` |
| `mloop_list` | List experiments | `projectPath` |
| `mloop_promote` | Promote to production | `projectPath, experimentId` |
| `mloop_compare` | Compare experiments | `projectPath, experiments[]` |
| `mloop_status` | Project status | `projectPath` |
| `mloop_evaluate` | Evaluate model | `projectPath` |
| `mloop_validate` | Validate config | `projectPath` |
| `mloop_prep` | Run preprocessing | `projectPath` |
| `mloop_logs` | View prediction logs | `projectPath` |
| `mloop_feedback` | Manage feedback | `projectPath, action` |
| `mloop_sample` | Data sampling | `projectPath, action` |
| `mloop_trigger` | Check retrain triggers | `projectPath` |
| `mloop_serve` | Start API server | `projectPath` |

## Recommended Workflows

### New Project (1 call)
Use `mloop_quick_start` — handles init, train, and promote automatically.

### Retrain Existing Project (1 call)
Use `mloop_auto_train` — profiles data, trains with auto-time, lists results.

### Check Project Status (1 call)
Use `mloop_project_overview` — returns status, experiments, and production metrics.

### Detailed Step-by-Step (multiple calls)
1. `mloop_info` — understand data (or `mloop_analyze <aspect>` for one EDA dimension as JSON: profile, correlation, importance, outliers, distribution)
2. `mloop_init` — create project
3. `mloop_train` — train model
4. `mloop_list` — review experiments
5. `mloop_promote` — promote best model
6. `mloop_predict` — run predictions

## Token-Saving Tips
- Prefer composite tools (`quick_start`, `auto_train`, `project_overview`) over individual calls
- Omit `time` parameter to use auto-time estimation
- Omit `dataFile` to use default `datasets/train.csv`
- Omit `modelName` to use default model

## Error Recovery

| Error | Recovery |
|-------|---------|
| "No mloop.yaml found" | Run `mloop_init` first |
| "Label column not found" | Run `mloop_info` to check column names |
| "Training failed" | Run `mloop_validate` to check config |
| "No production model" | Run `mloop_list` then `mloop_promote` |

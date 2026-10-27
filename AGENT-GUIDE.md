# MLoop MCP — Agent Guide

## Quick Reference

| Tool | Purpose | Key Params |
|------|---------|------------|
| `mloop_quick_start` | Zero to production in one call (any task; `label` only for the tasks that have one) | `projectPath, dataFile, label?, task` |
| `mloop_auto_train` | Retrain with auto-time | `projectPath, dataFile?` |
| `mloop_project_overview` | Full project status | `projectPath` |
| `mloop_init` | Initialize project — any of the 16 tasks (`regression`, `binary-classification`, `multiclass-classification`, `anomaly-detection`, `clustering`, `ranking`, `forecasting`, `time-series-anomaly`, `image-classification`, `object-detection`, `image-anomaly`, `text-classification`, `sentence-similarity`, `ner`, `question-answering`, `recommendation`) | `projectPath, task` |
| `mloop_info` | Profile dataset | `dataFile, projectPath?` |
| `mloop_analyze` | One read-only EDA aspect as JSON | `aspect, dataFile, label?` |
| `mloop_detect` | One-shot TS-anomaly detection + SPC bounds (no training) | `dataPath, column?, threshold?, sensitivity?` |
| `mloop_prep_plan` | Declare a prep step in mloop.yaml (policy only) as JSON | `projectPath, set?/remove?, columns?` |
| `mloop_features_select` | Declare feature include/exclude in mloop.yaml (policy only) as JSON | `projectPath, drop?/keep?/reset?` |
| `mloop_train` | Train model; `additionalDataFiles` merges more files (a retraining set from `mloop_sample`), `weight` trains on its weight column; answers the run's `result` and `warnings` as JSON, reports per-trial progress to a progress token, and stops the run when the call is cancelled | `projectPath, dataFile?, label?, time?` |
| `mloop_predict` | Run predictions (production, or a candidate by `experimentId`) | `projectPath, dataFile?, experimentId?` |
| `mloop_list` | List experiments | `projectPath` |
| `mloop_promote` | Promote to production (ID or auto: latest/best); refused by the quality gate unless `force` | `projectPath, experimentId? \| latest? \| best?, force?` |
| `mloop_rollback` | Production back to the experiment it held before | `projectPath, to?` |
| `mloop_threshold` | Decision threshold for a target precision (binary) | `projectPath, precision?, precisionOf?, dataFile?, clear?` |
| `mloop_calibrate` | Probability calibration on labeled rows, no retraining (binary · multiclass) | `projectPath, dataFile?, method?, weight?, clear?` |
| `mloop_export_onnx` | Model as ONNX + manifest for runtimes without ML.NET | `projectPath, experimentId?, dataFile?, outputDir?` |
| `mloop_compare` | Compare experiments | `projectPath, experiments[]` |
| `mloop_status` | Project status | `projectPath` |
| `mloop_evaluate` | Evaluate model; `against` compares a candidate with production row by row | `projectPath` |
| `mloop_validate` | Validate config | `projectPath` |
| `mloop_prep` | Run preprocessing | `projectPath` |
| `mloop_logs` | View prediction logs | `projectPath` |
| `mloop_feedback` | Record the actual value of a logged prediction (`source`, `weight` = 1/p for a row reviewed with probability p), list it, or measure accuracy with it | `projectPath, action` |
| `mloop_sample` | A retraining dataset from a model's logged predictions and feedback (feedback under the model's label, weighted when feedback is), or a sample of a CSV | `projectPath, action` |
| `mloop_trigger` | Check retrain triggers | `projectPath` |
| `mloop_drift` | Input drift per column (PSI), answer drift, and per slice | `projectPath` |
| `mloop_serve` | Start API server; returns once `/health` answers, with its URL, pid, log file and stop command — it keeps running after the call | `projectPath` |
| `mloop_token` | Bearer token for the server (every endpoint but `/health`); `role: admin` for the write endpoints | `projectPath` |
| `mloop_embed` | Images or texts → vectors + encoder identity | `projectPath, images? \| texts?` |
| `mloop_encoder` | List · install · remove pretrained encoders | `projectPath, action` |

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
   - Record feature-engineering decisions from the analysis (policy only, no data change): `mloop_features_select` to drop/keep columns, `mloop_prep_plan` to declare scaling/normalization (each step's JSON reports its leakage `category`/`foldSafe`)
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

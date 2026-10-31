/**
 * Tool registry - exports all MLoop MCP tools
 */

// Existing tools
export { trainTool, train, trainSchema, type TrainParams } from './train.js';
export { predictTool, predict, predictSchema, type PredictParams } from './predict.js';
export { listTool, list, listSchema, type ListParams } from './list.js';
export { promoteTool, promote, promoteSchema, type PromoteParams } from './promote.js';
export { rollbackTool, rollback, rollbackSchema, type RollbackParams } from './rollback.js';
export { thresholdTool, threshold, thresholdSchema, type ThresholdParams } from './threshold.js';
export { calibrateTool, calibrate, calibrateSchema, type CalibrateParams } from './calibrate.js';
export { exportOnnxTool, exportOnnx, exportOnnxSchema, type ExportOnnxParams } from './export-onnx.js';
export { infoTool, info, infoSchema, type InfoParams } from './info.js';
export { statusTool, status, statusSchema, type StatusParams } from './status.js';
export { compareTool, compare, compareSchema, type CompareParams } from './compare.js';
export { evaluateTool, evaluate, evaluateSchema, type EvaluateParams } from './evaluate.js';
export { serveTool, serve, serveSchema, type ServeParams } from './serve.js';

// New basic tools
export { initTool, init, initSchema, type InitParams } from './init.js';
export { validateTool, validate, validateSchema, type ValidateParams } from './validate.js';
export { prepTool, prep, prepSchema, type PrepParams } from './prep.js';
export { logsTool, logs, logsSchema, type LogsParams } from './logs.js';
export { feedbackTool, feedback, feedbackSchema, type FeedbackParams } from './feedback.js';
export { sampleTool, sample, sampleSchema, type SampleParams } from './sample.js';
export { triggerTool, trigger, triggerSchema, type TriggerParams } from './trigger.js';
export { driftTool, drift, driftSchema, type DriftParams } from './drift.js';
export { analyzeTool, analyze, analyzeSchema, type AnalyzeParams } from './analyze.js';
export { detectTool, detect, detectSchema, type DetectParams } from './detect.js';
export { prepPlanTool, prepPlan, prepPlanSchema, type PrepPlanParams } from './prep-plan.js';
export { featuresSelectTool, featuresSelect, featuresSelectSchema, type FeaturesSelectParams } from './features-select.js';
export { tokenTool, token, tokenSchema, type TokenParams } from './token.js';
export { embedTool, embed, embedSchema, type EmbedParams } from './embed.js';
export { encoderTool, encoder, encoderSchema, type EncoderParams } from './encoder.js';
export { explainTool, explain, explainSchema, type ExplainParams } from './explain.js';
export { runtimeTool, runtime, runtimeSchema, type RuntimeParams } from './runtime.js';
export { dockerTool, docker, dockerSchema, type DockerParams } from './docker.js';

// Composite workflow tools
export { quickStartTool, quickStart, quickStartSchema, type QuickStartParams } from './quick-start.js';
export { autoTrainTool, autoTrain, autoTrainSchema, type AutoTrainParams } from './auto-train.js';
export { projectOverviewTool, projectOverview, projectOverviewSchema, type ProjectOverviewParams } from './project-overview.js';

/**
 * Tool registry - exports all MLoop MCP tools
 */

// Existing tools
export { trainTool, train, trainSchema, type TrainParams } from './train.js';
export { predictTool, predict, predictSchema, type PredictParams } from './predict.js';
export { listTool, list, listSchema, type ListParams } from './list.js';
export { promoteTool, promote, promoteSchema, type PromoteParams } from './promote.js';
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
export { analyzeTool, analyze, analyzeSchema, type AnalyzeParams } from './analyze.js';

// Composite workflow tools
export { quickStartTool, quickStart, quickStartSchema, type QuickStartParams } from './quick-start.js';
export { autoTrainTool, autoTrain, autoTrainSchema, type AutoTrainParams } from './auto-train.js';
export { projectOverviewTool, projectOverview, projectOverviewSchema, type ProjectOverviewParams } from './project-overview.js';

/**
 * All available tools
 */
export const allTools = [
  // Existing tools
  { name: 'mloop_train', module: () => import('./train.js') },
  { name: 'mloop_predict', module: () => import('./predict.js') },
  { name: 'mloop_list', module: () => import('./list.js') },
  { name: 'mloop_promote', module: () => import('./promote.js') },
  { name: 'mloop_info', module: () => import('./info.js') },
  { name: 'mloop_status', module: () => import('./status.js') },
  { name: 'mloop_compare', module: () => import('./compare.js') },
  { name: 'mloop_evaluate', module: () => import('./evaluate.js') },
  { name: 'mloop_serve', module: () => import('./serve.js') },
  // New basic tools
  { name: 'mloop_init', module: () => import('./init.js') },
  { name: 'mloop_validate', module: () => import('./validate.js') },
  { name: 'mloop_prep', module: () => import('./prep.js') },
  { name: 'mloop_logs', module: () => import('./logs.js') },
  { name: 'mloop_feedback', module: () => import('./feedback.js') },
  { name: 'mloop_sample', module: () => import('./sample.js') },
  { name: 'mloop_trigger', module: () => import('./trigger.js') },
  { name: 'mloop_analyze', module: () => import('./analyze.js') },
  // Composite workflow tools
  { name: 'mloop_quick_start', module: () => import('./quick-start.js') },
  { name: 'mloop_auto_train', module: () => import('./auto-train.js') },
  { name: 'mloop_project_overview', module: () => import('./project-overview.js') },
] as const;

/**
 * Tool registry - exports all MLoop MCP tools
 */

export { trainTool, train, trainSchema, type TrainParams } from './train.js';
export { predictTool, predict, predictSchema, type PredictParams } from './predict.js';
export { listTool, list, listSchema, type ListParams } from './list.js';
export { promoteTool, promote, promoteSchema, type PromoteParams } from './promote.js';
export { infoTool, info, infoSchema, type InfoParams } from './info.js';
export { statusTool, status, statusSchema, type StatusParams } from './status.js';
export { compareTool, compare, compareSchema, type CompareParams } from './compare.js';
export { evaluateTool, evaluate, evaluateSchema, type EvaluateParams } from './evaluate.js';
export { serveTool, serve, serveSchema, type ServeParams } from './serve.js';

/**
 * All available tools
 */
export const allTools = [
  { name: 'mloop_train', module: () => import('./train.js') },
  { name: 'mloop_predict', module: () => import('./predict.js') },
  { name: 'mloop_list', module: () => import('./list.js') },
  { name: 'mloop_promote', module: () => import('./promote.js') },
  { name: 'mloop_info', module: () => import('./info.js') },
  { name: 'mloop_status', module: () => import('./status.js') },
  { name: 'mloop_compare', module: () => import('./compare.js') },
  { name: 'mloop_evaluate', module: () => import('./evaluate.js') },
  { name: 'mloop_serve', module: () => import('./serve.js') },
] as const;

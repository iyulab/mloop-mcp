/**
 * MCP Server for MLoop CLI
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  // Existing tools
  trainTool, train, trainSchema,
  predictTool, predict, predictSchema,
  listTool, list, listSchema,
  promoteTool, promote, promoteSchema,
  infoTool, info, infoSchema,
  statusTool, status, statusSchema,
  compareTool, compare, compareSchema,
  evaluateTool, evaluate, evaluateSchema,
  serveTool, serve, serveSchema,
  // New basic tools
  initTool, init, initSchema,
  validateTool, validate, validateSchema,
  prepTool, prep, prepSchema,
  logsTool, logs, logsSchema,
  feedbackTool, feedback, feedbackSchema,
  sampleTool, sample, sampleSchema,
  triggerTool, trigger, triggerSchema,
  // Composite workflow tools
  quickStartTool, quickStart, quickStartSchema,
  autoTrainTool, autoTrain, autoTrainSchema,
  projectOverviewTool, projectOverview, projectOverviewSchema,
} from './tools/index.js';

/**
 * Create and configure the MCP server
 */
export function createServer(): McpServer {
  const server = new McpServer({
    name: 'mloop-mcp',
    version: '0.2.0',
  });

  // === Existing tools ===

  // Register mloop_train
  server.tool(
    trainTool.name,
    trainTool.description,
    trainSchema.shape,
    async (params) => train(params as Parameters<typeof train>[0])
  );

  // Register mloop_predict
  server.tool(
    predictTool.name,
    predictTool.description,
    predictSchema.shape,
    async (params) => predict(params as Parameters<typeof predict>[0])
  );

  // Register mloop_list
  server.tool(
    listTool.name,
    listTool.description,
    listSchema.shape,
    async (params) => list(params as Parameters<typeof list>[0])
  );

  // Register mloop_promote
  server.tool(
    promoteTool.name,
    promoteTool.description,
    promoteSchema.shape,
    async (params) => promote(params as Parameters<typeof promote>[0])
  );

  // Register mloop_info
  server.tool(
    infoTool.name,
    infoTool.description,
    infoSchema.shape,
    async (params) => info(params as Parameters<typeof info>[0])
  );

  // Register mloop_status
  server.tool(
    statusTool.name,
    statusTool.description,
    statusSchema.shape,
    async (params) => status(params as Parameters<typeof status>[0])
  );

  // Register mloop_compare
  server.tool(
    compareTool.name,
    compareTool.description,
    compareSchema.shape,
    async (params) => compare(params as Parameters<typeof compare>[0])
  );

  // Register mloop_evaluate
  server.tool(
    evaluateTool.name,
    evaluateTool.description,
    evaluateSchema.shape,
    async (params) => evaluate(params as Parameters<typeof evaluate>[0])
  );

  // Register mloop_serve
  server.tool(
    serveTool.name,
    serveTool.description,
    serveSchema.shape,
    async (params) => serve(params as Parameters<typeof serve>[0])
  );

  // === New basic tools ===

  // Register mloop_init
  server.tool(
    initTool.name,
    initTool.description,
    initSchema.shape,
    async (params) => init(params as Parameters<typeof init>[0])
  );

  // Register mloop_validate
  server.tool(
    validateTool.name,
    validateTool.description,
    validateSchema.shape,
    async (params) => validate(params as Parameters<typeof validate>[0])
  );

  // Register mloop_prep
  server.tool(
    prepTool.name,
    prepTool.description,
    prepSchema.shape,
    async (params) => prep(params as Parameters<typeof prep>[0])
  );

  // Register mloop_logs
  server.tool(
    logsTool.name,
    logsTool.description,
    logsSchema.shape,
    async (params) => logs(params as Parameters<typeof logs>[0])
  );

  // Register mloop_feedback
  server.tool(
    feedbackTool.name,
    feedbackTool.description,
    feedbackSchema.shape,
    async (params) => feedback(params as Parameters<typeof feedback>[0])
  );

  // Register mloop_sample
  server.tool(
    sampleTool.name,
    sampleTool.description,
    sampleSchema.shape,
    async (params) => sample(params as Parameters<typeof sample>[0])
  );

  // Register mloop_trigger
  server.tool(
    triggerTool.name,
    triggerTool.description,
    triggerSchema.shape,
    async (params) => trigger(params as Parameters<typeof trigger>[0])
  );

  // === Composite workflow tools ===

  // Register mloop_quick_start
  server.tool(
    quickStartTool.name,
    quickStartTool.description,
    quickStartSchema.shape,
    async (params) => quickStart(params as Parameters<typeof quickStart>[0])
  );

  // Register mloop_auto_train
  server.tool(
    autoTrainTool.name,
    autoTrainTool.description,
    autoTrainSchema.shape,
    async (params) => autoTrain(params as Parameters<typeof autoTrain>[0])
  );

  // Register mloop_project_overview
  server.tool(
    projectOverviewTool.name,
    projectOverviewTool.description,
    projectOverviewSchema.shape,
    async (params) => projectOverview(params as Parameters<typeof projectOverview>[0])
  );

  return server;
}

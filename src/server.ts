/**
 * MCP Server for MLoop CLI
 */

import { McpServer, type ServerContext } from '@modelcontextprotocol/server';
import type { z } from 'zod';
import {
  trainTool, trainSchema,
  predictTool, predictSchema,
  listTool, listSchema,
  promoteTool, promoteSchema,
  rollbackTool, rollbackSchema,
  thresholdTool, thresholdSchema,
  calibrateTool, calibrateSchema,
  exportOnnxTool, exportOnnxSchema,
  infoTool, infoSchema,
  statusTool, statusSchema,
  compareTool, compareSchema,
  evaluateTool, evaluateSchema,
  serveTool, serveSchema,
  initTool, initSchema,
  validateTool, validateSchema,
  prepTool, prepSchema,
  logsTool, logsSchema,
  feedbackTool, feedbackSchema,
  sampleTool, sampleSchema,
  triggerTool, triggerSchema,
  driftTool, driftSchema,
  analyzeTool, analyzeSchema,
  detectTool, detectSchema,
  prepPlanTool, prepPlanSchema,
  featuresSelectTool, featuresSelectSchema,
  quickStartTool, quickStartSchema,
  autoTrainTool, autoTrainSchema,
  projectOverviewTool, projectOverviewSchema,
} from './tools/index.js';
import { packageVersion } from './package-info.js';

type ToolResult = { content: Array<{ type: 'text'; text: string }>; isError?: boolean };

/** A tool module's definition: what the server registers under its name, and the function that answers it. */
interface ToolDefinition {
  name: string;
  description: string;
  // Each handler takes its own schema's parameters; the server validates against that schema before calling it.
  // The request's context carries its cancellation and progress token, for the tools that run long.
  handler: (params: any, ctx: ServerContext) => Promise<ToolResult>;
}

/** Every tool, with the schema its arguments are validated against — in the order `tools/list` names them. */
const tools: ReadonlyArray<readonly [ToolDefinition, z.ZodObject]> = [
  [trainTool, trainSchema],
  [predictTool, predictSchema],
  [listTool, listSchema],
  [promoteTool, promoteSchema],
  [rollbackTool, rollbackSchema],
  [thresholdTool, thresholdSchema],
  [calibrateTool, calibrateSchema],
  [exportOnnxTool, exportOnnxSchema],
  [infoTool, infoSchema],
  [statusTool, statusSchema],
  [compareTool, compareSchema],
  [evaluateTool, evaluateSchema],
  [serveTool, serveSchema],
  [initTool, initSchema],
  [validateTool, validateSchema],
  [prepTool, prepSchema],
  [logsTool, logsSchema],
  [feedbackTool, feedbackSchema],
  [sampleTool, sampleSchema],
  [triggerTool, triggerSchema],
  [driftTool, driftSchema],
  [analyzeTool, analyzeSchema],
  [detectTool, detectSchema],
  [prepPlanTool, prepPlanSchema],
  [featuresSelectTool, featuresSelectSchema],
  [quickStartTool, quickStartSchema],
  [autoTrainTool, autoTrainSchema],
  [projectOverviewTool, projectOverviewSchema],
];

/**
 * Create and configure the MCP server
 */
export function createServer(): McpServer {
  const server = new McpServer({
    name: 'mloop-mcp',
    version: packageVersion,
  });

  for (const [tool, schema] of tools) {
    server.registerTool(
      tool.name,
      { description: tool.description, inputSchema: schema },
      async (params, ctx) => tool.handler(params, ctx)
    );
  }

  return server;
}

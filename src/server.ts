/**
 * MCP Server for MLoop CLI
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  trainTool,
  train,
  trainSchema,
  predictTool,
  predict,
  predictSchema,
  listTool,
  list,
  listSchema,
  promoteTool,
  promote,
  promoteSchema,
  infoTool,
  info,
  infoSchema,
  statusTool,
  status,
  statusSchema,
  compareTool,
  compare,
  compareSchema,
  evaluateTool,
  evaluate,
  evaluateSchema,
  serveTool,
  serve,
  serveSchema,
} from './tools/index.js';

/**
 * Create and configure the MCP server
 */
export function createServer(): McpServer {
  const server = new McpServer({
    name: 'mloop-mcp',
    version: '0.1.0',
  });

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

  return server;
}

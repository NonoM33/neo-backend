import './tools/projects.tools';
import './tools/rooms.tools';
import './tools/devices.tools';
import './tools/knowledge.tools';
import './tools/tickets.tools';
import './tools/diagnostics.tools';

export { toolRegistry } from './mcp.registry';
export { executeTool } from './mcp.executor';
export type { ClientContext, MCPToolDefinition, MCPToolResult } from './mcp.types';

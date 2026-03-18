import type { MCPToolDefinition } from './mcp.types';

class ToolRegistry {
  private tools: Map<string, MCPToolDefinition> = new Map();

  register(tool: MCPToolDefinition) {
    this.tools.set(tool.name, tool);
  }

  get(name: string): MCPToolDefinition | undefined {
    return this.tools.get(name);
  }

  getAll(): MCPToolDefinition[] {
    return Array.from(this.tools.values());
  }

  getToolDefinitions() {
    return this.getAll().map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.inputSchema,
    }));
  }
}

export const toolRegistry = new ToolRegistry();

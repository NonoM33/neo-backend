export interface ClientContext {
  clientId: string;
  clientAccountId: string;
  sessionId: string;
  projectIds: string[];
}

export interface MCPToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, any>;
  handler: (ctx: ClientContext, params: any) => Promise<MCPToolResult>;
}

export interface MCPToolResult {
  success: boolean;
  data?: any;
  error?: string;
}

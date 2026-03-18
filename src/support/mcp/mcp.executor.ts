import { db } from '../../config/database';
import { aiAuditLog } from '../../db/schema';
import { toolRegistry } from './mcp.registry';
import type { ClientContext, MCPToolResult } from './mcp.types';

export async function executeTool(
  ctx: ClientContext,
  toolName: string,
  toolInput: any
): Promise<MCPToolResult> {
  const tool = toolRegistry.get(toolName);
  if (!tool) {
    return { success: false, error: `Outil inconnu: ${toolName}` };
  }

  const startTime = Date.now();
  let result: MCPToolResult;

  try {
    result = await tool.handler(ctx, toolInput || {});
  } catch (error: any) {
    result = { success: false, error: error.message || 'Erreur interne' };
  }

  const durationMs = Date.now() - startTime;

  // Audit log (fire and forget)
  db.insert(aiAuditLog)
    .values({
      sessionId: ctx.sessionId,
      clientAccountId: ctx.clientAccountId,
      toolName,
      toolInput,
      toolOutput: result.data || (result.error ? { error: result.error } : null),
      durationMs,
      success: result.success,
      errorMessage: result.error || null,
    })
    .catch(() => {}); // don't block on audit

  return result;
}

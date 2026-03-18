import Anthropic from '@anthropic-ai/sdk';
import { env } from '../../config/env';
import { toolRegistry, executeTool } from '../mcp';
import { SYSTEM_PROMPT } from './chat.context';
import * as chatService from './chat.service';
import type { ClientContext } from '../mcp/mcp.types';

const getClient = (() => {
  let client: Anthropic | null = null;
  return () => {
    if (!client) {
      client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
    }
    return client;
  };
})();

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: any;
}

function buildMessagesFromHistory(
  messages: Array<{ role: string; content: string | null; toolName?: string | null; toolInput?: any; toolOutput?: any }>
): ConversationMessage[] {
  const result: ConversationMessage[] = [];

  for (const msg of messages) {
    if (msg.role === 'user') {
      result.push({ role: 'user', content: msg.content || '' });
    } else if (msg.role === 'assistant') {
      result.push({ role: 'assistant', content: msg.content || '' });
    } else if (msg.role === 'tool_call') {
      // Merge tool_call into previous assistant message or create new one
      const lastMsg = result[result.length - 1];
      const toolUseBlock = {
        type: 'tool_use' as const,
        id: `tool_${msg.toolName}_${Date.now()}`,
        name: msg.toolName || '',
        input: msg.toolInput || {},
      };
      if (lastMsg && lastMsg.role === 'assistant') {
        if (typeof lastMsg.content === 'string') {
          lastMsg.content = lastMsg.content
            ? [{ type: 'text' as const, text: lastMsg.content }, toolUseBlock]
            : [toolUseBlock];
        } else if (Array.isArray(lastMsg.content)) {
          lastMsg.content.push(toolUseBlock);
        }
      } else {
        result.push({ role: 'assistant', content: [toolUseBlock] });
      }
    } else if (msg.role === 'tool_result') {
      result.push({
        role: 'user',
        content: [
          {
            type: 'tool_result' as const,
            tool_use_id: `tool_${msg.toolName}_${Date.now()}`,
            content: JSON.stringify(msg.toolOutput || {}),
          },
        ],
      });
    }
  }

  return result;
}

export async function processMessage(
  ctx: ClientContext,
  sessionId: string,
  userMessage: string,
  onChunk: (text: string) => void
): Promise<string> {
  const anthropic = getClient();

  // Get conversation history
  const history = await chatService.getSessionMessages(sessionId);
  const messages = buildMessagesFromHistory(history);

  // Add new user message
  messages.push({ role: 'user', content: userMessage });

  // Get MCP tools
  const tools = toolRegistry.getToolDefinitions();

  let fullResponse = '';
  let totalTokens = 0;
  let continueLoop = true;

  while (continueLoop) {
    continueLoop = false;

    const response = await anthropic.messages.create({
      model: env.AI_MODEL,
      max_tokens: env.AI_MAX_TOKENS,
      system: SYSTEM_PROMPT,
      messages: messages as any,
      tools: tools as any,
    });

    totalTokens += (response.usage?.input_tokens ?? 0) + (response.usage?.output_tokens ?? 0);

    const assistantContent: any[] = [];
    let textContent = '';

    for (const block of response.content) {
      if (block.type === 'text') {
        textContent += block.text;
        onChunk(block.text);
        assistantContent.push(block);
      } else if (block.type === 'tool_use') {
        assistantContent.push(block);

        // Store tool call
        await chatService.addMessage(sessionId, 'tool_call', null, {
          toolName: block.name,
          toolInput: block.input,
        });

        // Execute tool
        const toolResult = await executeTool(ctx, block.name, block.input);

        // Store tool result
        await chatService.addMessage(sessionId, 'tool_result', null, {
          toolName: block.name,
          toolOutput: toolResult,
        });

        // If tool was create_support_ticket and succeeded, mark session as escalated
        if (block.name === 'create_support_ticket' && toolResult.success) {
          await chatService.markSessionEscalated(sessionId);
        }

        // Add to messages for next iteration
        messages.push({ role: 'assistant', content: assistantContent });
        messages.push({
          role: 'user',
          content: [
            {
              type: 'tool_result' as const,
              tool_use_id: block.id,
              content: JSON.stringify(toolResult),
            },
          ],
        });

        continueLoop = true;
        break; // Process one tool at a time
      }
    }

    if (!continueLoop) {
      fullResponse = textContent;

      // Store assistant message
      await chatService.addMessage(sessionId, 'assistant', textContent, {
        tokenCount: totalTokens,
        modelId: env.AI_MODEL,
      });
    }
  }

  return fullResponse;
}

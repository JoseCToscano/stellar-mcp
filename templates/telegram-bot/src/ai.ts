// src/ai.ts
//
// AI chat mode — wraps @stellar-mcp/client tools as Vercel AI SDK tools,
// then runs an agentic loop via generateText().
//
// The LLM has full access to the connected MCP server's contract tools.
//
// Read operations: simulationResult is returned directly to the LLM.
// Write operations: signed and submitted automatically when SIGNER_SECRET is set.
//   Unlike command mode (which shows a confirmation button), AI mode auto-signs
//   because the user explicitly opted into AI by enabling it AND by asking the
//   LLM to perform an action in natural language. The agentic loop would break
//   if it had to pause mid-execution for interactive confirmation.
//
// Provider selection (first match wins):
//   ANTHROPIC_API_KEY → claude-haiku-4-5-20251001
//   OPENAI_API_KEY    → gpt-4o

import { generateText, tool, stepCountIs } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import { secretKeySigner, type ToolInfo } from '@stellar-mcp/client';
import type { ModelMessage, LanguageModel } from 'ai';
import { createClient, canSign } from './mcp.js';
import { isReadOperation } from './conversation.js';

// ─── Model selection ──────────────────────────────────────────────────────────

function getModel(): LanguageModel {
  if (process.env.ANTHROPIC_API_KEY) {
    return anthropic('claude-haiku-4-5-20251001');
  }
  if (process.env.OPENAI_API_KEY) {
    return openai('gpt-4o');
  }
  throw new Error(
    'No AI API key configured. Set ANTHROPIC_API_KEY or OPENAI_API_KEY in your .env file.',
  );
}

// ─── Tool builder ─────────────────────────────────────────────────────────────

// Converts @stellar-mcp/client ToolInfo[] into Vercel AI SDK tool definitions.
// Each tool's execute callback calls client.call() and signs + submits if
// the call returns XDR (a write operation).
//
// In AI SDK v6, Tool uses `inputSchema` (not `parameters`).
function buildAITools(stellarTools: ToolInfo[]) {
  return Object.fromEntries(
    stellarTools.map((t) => {
      // Augment the tool description with arg names, types, and descriptions.
      // This is what guides the LLM to pass correct arguments.
      const props = (t.inputSchema.properties ?? {}) as Record<
        string,
        { type?: string; description?: string }
      >;
      const argDoc = Object.entries(props)
        .map(([name, def]) => `  - ${name} (${def.type ?? 'any'}): ${def.description ?? ''}`)
        .join('\n');
      const description = argDoc
        ? `${t.description}\nParameters:\n${argDoc}`
        : t.description;

      // Zod schema:
      //   - No properties → z.object({}) (strict empty, for read-only tools)
      //   - Has properties → z.record(z.unknown()) (any key-value pairs)
      // The LLM reads the description to know what keys and values to provide.
      const hasArgs = Object.keys(props).length > 0;
      const inputSchema = hasArgs ? z.object({}).passthrough() : z.object({});

      return [
        t.name,
        tool({
          description,
          inputSchema,
          execute: async (args) => {
            const client = createClient();
            try {
              const result = await client.call(t.name as never, args as never);

              // Read operations: return the simulationResult directly
              if (isReadOperation(t.name) || !result.xdr) {
                return result.simulationResult ?? result.data ?? 'completed';
              }

              // Write operations: sign and submit if signer is configured
              if (canSign()) {
                const submit = await client.signAndSubmit(result.xdr, {
                  signer: secretKeySigner(process.env.SIGNER_SECRET!),
                });
                return {
                  success: true,
                  transactionHash: submit.hash,
                  status: submit.status,
                };
              }

              // No signer key — return preview only
              return {
                preview: result.simulationResult ?? result.data,
                note: 'This is a write operation but SIGNER_SECRET is not configured. The transaction was simulated but not submitted.',
              };
            } finally {
              client.close();
            }
          },
        }),
      ];
    }),
  );
}

// ─── System prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a helpful Stellar blockchain assistant connected to a Soroban smart contract via an MCP server.

You have access to the contract's functions as tools. Use them to:
- Answer questions about the contract's state
- Execute transactions on behalf of the user (when SIGNER_SECRET is configured)
- Explain what operations are available

Be concise and clear. When reporting transaction results, include the transaction hash.
When reporting read results, format them clearly for a Telegram message.
Do not use Markdown formatting — plain text only, as this is a Telegram bot.`;

// ─── Main chat function ───────────────────────────────────────────────────────

export async function chat(
  userMessage: string,
  history: ModelMessage[],
): Promise<string> {
  // Fetch tools fresh on each call (MCP server may update tools)
  const client = createClient();
  let tools: ReturnType<typeof buildAITools>;
  try {
    const stellarTools = await client.listTools();
    tools = buildAITools(stellarTools);
  } finally {
    client.close();
  }

  const result = await generateText({
    model: getModel(),
    system: SYSTEM_PROMPT,
    messages: [...history, { role: 'user', content: userMessage } as ModelMessage],
    tools,
    stopWhen: [stepCountIs(10)], // Max 10 tool call steps per message
  });

  return result.text || 'Done.';
}

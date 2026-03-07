// src/handlers/call.ts
//
// Handles three distinct paths:
//   1. /call              → show inline keyboard of all tools
//   2. /call <tool>       → show tool detail (description + arg preview + example)
//   3. /call <tool> {...} → execute the tool, sign + submit if XDR returned
//
// Also handles callback queries from the inline keyboard:
//   tool:<name>           → show tool detail (same as path 2 above)

import type { Context } from 'grammy';
import { MCPToolError, MCPConnectionError, secretKeySigner } from '@stellar-mcp/client';
import { createClient, canSign } from '../mcp.js';
import { buildToolsKeyboard } from '../keyboards.js';
import {
  formatToolDetail,
  formatCallResult,
  formatError,
  formatConnectionError,
} from '../formatters.js';

// ─── /call command ────────────────────────────────────────────────────────────

export async function handleCall(ctx: Context): Promise<void> {
  const args = ((ctx.match as string | undefined) ?? '').trim();

  if (!args) {
    await showToolPicker(ctx);
    return;
  }

  // Split into tool name and optional JSON args
  const spaceIdx = args.indexOf(' ');
  const toolName = spaceIdx === -1 ? args : args.slice(0, spaceIdx).trim();
  const jsonPart = spaceIdx === -1 ? '' : args.slice(spaceIdx + 1).trim();

  if (!jsonPart) {
    // No args provided — show tool detail
    await showToolDetail(ctx, toolName);
  } else {
    // Args provided — execute the tool
    await executeTool(ctx, toolName, jsonPart);
  }
}

// ─── Callback query: tool:<name> ──────────────────────────────────────────────

export async function handleToolCallback(ctx: Context): Promise<void> {
  // Answer immediately to dismiss Telegram's loading spinner on the button
  await ctx.answerCallbackQuery();

  const toolName = (ctx.callbackQuery?.data ?? '').replace(/^tool:/, '');
  const client = createClient();

  try {
    const tools = await client.listTools();
    const tool = tools.find((t) => t.name === toolName);

    if (!tool) {
      await ctx.editMessageText(`Tool <b>${toolName}</b> not found on this server.`, {
        parse_mode: 'HTML',
      });
      return;
    }

    await ctx.editMessageText(formatToolDetail(tool), { parse_mode: 'HTML' });
  } catch (err) {
    await ctx.editMessageText(formatConnectionError(err), { parse_mode: 'HTML' });
  } finally {
    client.close();
  }
}

// ─── Internal: show tool picker ───────────────────────────────────────────────

async function showToolPicker(ctx: Context): Promise<void> {
  const client = createClient();
  try {
    const tools = await client.listTools();

    if (tools.length === 0) {
      await ctx.reply('No tools found on the connected MCP server.');
      return;
    }

    const keyboard = buildToolsKeyboard(tools);
    await ctx.reply('Choose a tool to inspect or call:', {
      reply_markup: keyboard,
    });
  } catch (err) {
    await ctx.reply(formatConnectionError(err), { parse_mode: 'HTML' });
  } finally {
    client.close();
  }
}

// ─── Internal: show tool detail ───────────────────────────────────────────────

async function showToolDetail(ctx: Context, toolName: string): Promise<void> {
  const client = createClient();
  try {
    const tools = await client.listTools();
    const tool = tools.find((t) => t.name === toolName);

    if (!tool) {
      await ctx.reply(
        `Tool <b>${toolName}</b> not found.\n\nUse /tools to see available tools.`,
        { parse_mode: 'HTML' },
      );
      return;
    }

    await ctx.reply(formatToolDetail(tool), { parse_mode: 'HTML' });
  } catch (err) {
    await ctx.reply(formatConnectionError(err), { parse_mode: 'HTML' });
  } finally {
    client.close();
  }
}

// ─── Internal: execute a tool ─────────────────────────────────────────────────

async function executeTool(
  ctx: Context,
  toolName: string,
  jsonArgs: string,
): Promise<void> {
  // Parse JSON arguments
  let parsedArgs: Record<string, unknown> = {};
  try {
    const parsed: unknown = JSON.parse(jsonArgs);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      await ctx.reply(
        'Arguments must be a JSON object.\n\nExample:\n' +
          `<code>/call deploy-token {"deployer":"GABC...","config":{}}</code>`,
        { parse_mode: 'HTML' },
      );
      return;
    }
    parsedArgs = parsed as Record<string, unknown>;
  } catch {
    await ctx.reply(
      '❌ Invalid JSON arguments.\n\nUse <code>/call &lt;tool&gt;</code> to see the expected format.',
      { parse_mode: 'HTML' },
    );
    return;
  }

  // Show immediate feedback — edited in place when done
  const statusMsg = await ctx.reply(`⏳ Calling <b>${toolName}</b>...`, { parse_mode: 'HTML' });

  const client = createClient();
  try {
    const result = await client.call(toolName as never, parsedArgs as never);

    if (result.xdr && canSign()) {
      await ctx.api.editMessageText(
        statusMsg.chat.id,
        statusMsg.message_id,
        `⏳ Signing and submitting transaction...`,
      );

      const submit = await client.signAndSubmit(result.xdr, {
        signer: secretKeySigner(process.env.SIGNER_SECRET!),
      });

      await ctx.api.editMessageText(
        statusMsg.chat.id,
        statusMsg.message_id,
        formatCallResult(toolName, result, submit),
        { parse_mode: 'HTML' },
      );
    } else {
      await ctx.api.editMessageText(
        statusMsg.chat.id,
        statusMsg.message_id,
        formatCallResult(toolName, result),
        { parse_mode: 'HTML' },
      );
    }
  } catch (err) {
    let text: string;
    if (err instanceof MCPConnectionError) {
      text = formatConnectionError(err);
    } else if (err instanceof MCPToolError) {
      text = formatError(err.toolName ?? toolName, err);
    } else {
      text = formatError(toolName, err);
    }

    await ctx.api.editMessageText(statusMsg.chat.id, statusMsg.message_id, text, {
      parse_mode: 'HTML',
    });
  } finally {
    client.close();
  }
}

// src/handlers/call.ts
//
// Handles three paths:
//   1. /call              → show inline keyboard of all tools
//   2. /call <tool>       → launch form card (or execute if no args)
//   3. /call <tool> {...} → execute the tool directly with JSON args
//
// Callback query from the tool picker keyboard:
//   tool:<name>           → same as (2), reusing the picker message

import type { Context } from 'grammy';
import { MCPToolError, MCPConnectionError, secretKeySigner } from '@stellar-mcp/client';
import { createClient, canSign } from '../mcp.js';
import { buildToolsKeyboard, buildConfirmKeyboard } from '../keyboards.js';
import {
  esc,
  formatReadResult,
  formatWriteConfirmation,
  formatWriteNoSigner,
  formatError,
  formatConnectionError,
} from '../formatters.js';
import { handleToolCommand } from './tool-command.js';
import { getForm, cancelForm, isReadOperation, setPendingSign } from '../conversation.js';

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
    // No args provided — launch form card (or execute directly for no-arg tools)
    await handleToolCommand(ctx, toolName);
  } else {
    // Args provided — execute the tool
    await executeTool(ctx, toolName, jsonPart);
  }
}

// ─── Callback query: tool:<name> ──────────────────────────────────────────────
//
// Instead of showing a static text detail, this now launches the form card
// (or executes directly for no-arg tools) — reusing the tool picker message.

export async function handleToolCallback(ctx: Context): Promise<void> {
  await ctx.answerCallbackQuery();

  const toolName = (ctx.callbackQuery?.data ?? '').replace(/^tool:/, '');
  const messageId = ctx.callbackQuery?.message?.message_id;
  if (!messageId) return;

  // Delegate to the form card handler, reusing the tool picker message
  await handleToolCommand(ctx, toolName, undefined, messageId);
}

// ─── Internal: show tool picker ───────────────────────────────────────────────

async function showToolPicker(ctx: Context): Promise<void> {
  // Cancel any active form (user switched context to browsing tools)
  const chatId = ctx.chat?.id;
  if (chatId) {
    const existing = getForm(chatId);
    if (existing) {
      try {
        await ctx.api.editMessageText(chatId, existing.formMessageId, '✗ Cancelled.');
      } catch { /* message may be gone */ }
      cancelForm(chatId);
    }
  }

  const client = createClient();
  try {
    const tools = await client.listTools();

    if (tools.length === 0) {
      await ctx.reply('No tools found on the connected MCP server.');
      return;
    }

    const keyboard = buildToolsKeyboard(tools);
    await ctx.reply('⚡ <b>Select a tool</b>\n\n<i>Tap to configure and execute</i>', {
      parse_mode: 'HTML',
      reply_markup: keyboard,
    });
  } catch (err) {
    await ctx.reply(formatConnectionError(err), { parse_mode: 'HTML' });
  } finally {
    client.close();
  }
}

// ─── Internal: execute a tool (power-user JSON path) ─────────────────────────

async function executeTool(
  ctx: Context,
  toolName: string,
  jsonArgs: string,
): Promise<void> {
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

  const statusMsg = await ctx.reply(`⏳ Calling <b>${esc(toolName)}</b>…`, { parse_mode: 'HTML' });
  const chatId = statusMsg.chat.id;
  const messageId = statusMsg.message_id;

  const client = createClient();
  try {
    const result = await client.call(toolName as never, parsedArgs as never);

    if (isReadOperation(toolName) || !result.xdr) {
      // Read operation — show result directly
      await ctx.api.editMessageText(chatId, messageId, formatReadResult(toolName, result), {
        parse_mode: 'HTML',
      });
    } else if (!canSign()) {
      // Write but no signer key
      await ctx.api.editMessageText(chatId, messageId, formatWriteNoSigner(toolName, result), {
        parse_mode: 'HTML',
      });
    } else {
      // Write operation — show confirmation
      setPendingSign(chatId, messageId, toolName, result.xdr);
      await ctx.api.editMessageText(chatId, messageId, formatWriteConfirmation(toolName, result), {
        parse_mode: 'HTML',
        reply_markup: buildConfirmKeyboard(),
      });
    }
  } catch (err) {
    let text: string;
    if (err instanceof MCPConnectionError) text = formatConnectionError(err);
    else if (err instanceof MCPToolError) text = formatError(err.toolName ?? toolName, err);
    else text = formatError(toolName, err);

    await ctx.api.editMessageText(chatId, messageId, text, { parse_mode: 'HTML' });
  } finally {
    client.close();
  }
}

// src/bot.ts
//
// Creates and configures the Bot instance. All command handlers and callback
// query handlers are registered here. Imported by both:
//   - api/webhook.ts  (Vercel serverless — production)
//   - scripts/dev.ts  (long polling — local development)
//
// Dynamic per-tool commands (e.g. /deploy_token, /get_admin) are registered
// at startup by scripts/dev.ts or scripts/setup.ts. They route through the
// generic 'message:entities:bot_command' handler below.

import { Bot, GrammyError, HttpError } from 'grammy';
import { handleStart } from './handlers/start.js';
import { handleTools } from './handlers/tools.js';
import { handleCall, handleToolCallback } from './handlers/call.js';
import { handleChat } from './handlers/chat.js';
import { handleToolCommand, handleFormCallback, handleFormTextReply } from './handlers/tool-command.js';
import { cancelForm, getForm } from './conversation.js';
import { toolToCommand, commandToTool } from './commands.js';
import { createClient } from './mcp.js';

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) throw new Error('TELEGRAM_BOT_TOKEN is not set');

export const bot = new Bot(token);

// ── Static commands ───────────────────────────────────────────────────────────

bot.command('start', handleStart);
bot.command('tools', handleTools);
bot.command('call', handleCall);

bot.command('cancel', async (ctx) => {
  cancelForm(ctx.chat.id);
  await ctx.reply('Cancelled. Use a command to start a new operation.');
});

const STATIC_COMMANDS = new Set(['start', 'tools', 'call', 'cancel']);

// ── Dynamic tool commands ─────────────────────────────────────────────────────
// Route any command that matches a known MCP tool to the form card handler.
// We do a runtime lookup (rather than pre-building handlers at startup) so it
// works correctly in serverless environments where bot state doesn't persist.

bot.on(':entities:bot_command', async (ctx) => {
  const entity = ctx.message?.entities?.find((e) => e.type === 'bot_command');
  if (!entity) return;

  const rawText = ctx.message?.text ?? '';
  const command = rawText.slice(entity.offset + 1, entity.offset + entity.length);
  const commandName = command.split('@')[0].toLowerCase();

  if (STATIC_COMMANDS.has(commandName)) return;

  const client = createClient();
  try {
    const tools = await client.listTools();
    const toolName = commandToTool(commandName);
    const tool = tools.find((t) => toolToCommand(t.name) === commandName || t.name === toolName);
    if (tool) {
      // Pass the pre-fetched tool so handleToolCommand doesn't re-fetch
      await handleToolCommand(ctx, commandName, tool);
    }
  } catch {
    // MCP server unreachable — silently ignore unknown commands
  } finally {
    client.close();
  }
});

// ── Callback queries ──────────────────────────────────────────────────────────

// Tool detail from /call keyboard: "tool:<name>"
bot.callbackQuery(/^tool:/, handleToolCallback);

// Form card interactions: "form:set:*", "form:bool:*", "form:enum:*", "form:exec", "form:cancel", "form:view"
bot.callbackQuery(/^form:/, handleFormCallback);

// Catch-all for unhandled callback queries
bot.on('callback_query:data', async (ctx) => {
  await ctx.answerCallbackQuery();
});

// ── Text messages (non-commands) ──────────────────────────────────────────────

bot.on('message:text', async (ctx) => {
  const chatId = ctx.chat.id;
  const form = getForm(chatId);

  // If a form is awaiting a text reply for a specific field, handle it
  if (form && form.pendingFieldIndex !== null) {
    await handleFormTextReply(ctx);
    return;
  }

  // Otherwise: AI mode or guide to commands
  if (process.env.AI_ENABLED === 'true') {
    await handleChat(ctx);
  } else {
    await ctx.reply(
      'Type a <b>/command</b> to call a contract tool.\n\n' +
        'Use /tools to see what\'s available, or /call to browse interactively.\n\n' +
        'Set <code>AI_ENABLED=true</code> and an API key for natural language chat.',
      { parse_mode: 'HTML' },
    );
  }
});

// ── Error handler ─────────────────────────────────────────────────────────────

bot.catch((err) => {
  const ctx = err.ctx;
  console.error(`[bot] Error on update ${ctx.update.update_id}:`);
  const e = err.error;
  if (e instanceof GrammyError) {
    console.error('[bot] Telegram API error:', e.description);
  } else if (e instanceof HttpError) {
    console.error('[bot] Network error:', e);
  } else {
    console.error('[bot] Unknown error:', e);
  }
});

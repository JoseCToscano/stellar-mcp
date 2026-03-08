// src/handlers/tool-command.ts
//
// Handles dynamically registered tool commands (e.g. /deploy_token, /get_admin)
// using the form card UX pattern.
//
// Flow:
//   1. User sends /deploy_token
//   2. Bot sends a form card message showing all parameters (⬜ = not set, ✅ = set)
//   3. User taps a field button:
//      - boolean field  → keyboard swaps inline to [✅ True] [❌ False]
//      - enum field     → keyboard swaps inline to one button per option
//      - text/number    → bot sends ForceReply prompt; form card updates on reply
//   4. After each value is set the form card updates in place with the new value
//   5. User taps ▶ Execute — tool is called with all collected args

import type { Context } from 'grammy';
import type { ToolInfo } from '@stellar-mcp/client';
import { MCPToolError, MCPConnectionError, secretKeySigner } from '@stellar-mcp/client';
import { createClient, canSign } from '../mcp.js';
import {
  startForm,
  setArg,
  getForm,
  cancelForm,
  setPendingField,
  isFormComplete,
  parseArgValue,
  extractArgs,
  buildToolArgs,
  argKey,
  isReadOperation,
  setPendingSign,
  getPendingSign,
  clearPendingSign,
} from '../conversation.js';
import {
  esc,
  formatForm,
  formatReadResult,
  formatWriteConfirmation,
  formatWriteNoSigner,
  formatSubmitResult,
  formatError,
  formatConnectionError,
} from '../formatters.js';
import { buildFormKeyboard, buildBooleanSubKeyboard, buildEnumSubKeyboard, buildConfirmKeyboard } from '../keyboards.js';
import { commandToTool } from '../commands.js';

// ─── Entry point ──────────────────────────────────────────────────────────────

// Called when a user sends a dynamic tool command like /deploy_token.
// Accepts an optional pre-fetched ToolInfo to avoid a redundant listTools() call
// (bot.ts already fetches tools to verify the command exists).
//
// reuseMessageId: if provided, edits this message in place instead of sending a
// new one. Used when launching a form from the /call inline keyboard callback —
// the tool picker message transforms directly into the form card.
export async function handleToolCommand(
  ctx: Context,
  toolCommand: string,
  prefetchedTool?: ToolInfo,
  reuseMessageId?: number,
): Promise<void> {
  const toolName = commandToTool(toolCommand);
  const chatId = ctx.chat!.id;

  // Use the pre-fetched tool if provided, otherwise fetch fresh
  let tool = prefetchedTool;
  if (!tool) {
    const client = createClient();
    try {
      const tools = await client.listTools();
      tool = tools.find((t) => t.name === toolName);
    } finally {
      client.close();
    }
  }

  if (!tool) {
    const notFound = `Tool <b>${esc(toolName)}</b> not found on the connected MCP server.\n\nUse /tools to see what's available.`;
    if (reuseMessageId) {
      await ctx.api.editMessageText(chatId, reuseMessageId, notFound, { parse_mode: 'HTML' });
    } else {
      await ctx.reply(notFound, { parse_mode: 'HTML' });
    }
    return;
  }

  // If the user already has an active form, cancel it and deactivate the old card
  const existing = getForm(chatId);
  if (existing && existing.formMessageId !== reuseMessageId) {
    try {
      await ctx.api.editMessageText(
        chatId,
        existing.formMessageId,
        '✗ Cancelled (new command started).',
      );
    } catch {
      // Old message may already be gone — ignore
    }
    cancelForm(chatId);
  }

  // No args → execute immediately (read-only tools like get-admin)
  if (extractArgs(tool).length === 0) {
    let messageId: number;
    if (reuseMessageId) {
      await ctx.api.editMessageText(chatId, reuseMessageId, `⏳ Calling <b>${esc(toolName)}</b>...`, {
        parse_mode: 'HTML',
      });
      messageId = reuseMessageId;
    } else {
      const statusMsg = await ctx.reply(`⏳ Calling <b>${esc(toolName)}</b>...`, { parse_mode: 'HTML' });
      messageId = statusMsg.message_id;
    }
    await executeTool(ctx, chatId, messageId, toolName, {});
    return;
  }

  // Show form card — reuse existing message or send a new one
  let formMessageId: number;
  if (reuseMessageId) {
    formMessageId = reuseMessageId;
  } else {
    const formMsg = await ctx.reply('⏳ Loading...', { parse_mode: 'HTML' });
    formMessageId = formMsg.message_id;
  }

  const state = startForm(chatId, tool, formMessageId);
  if (!state) {
    await ctx.api.editMessageText(chatId, formMessageId, `⏳ Calling <b>${esc(toolName)}</b>...`, {
      parse_mode: 'HTML',
    });
    await executeTool(ctx, chatId, formMessageId, toolName, {});
    return;
  }

  await ctx.api.editMessageText(chatId, formMessageId, formatForm(state), {
    parse_mode: 'HTML',
    reply_markup: buildFormKeyboard(state),
  });
}

// ─── Form callback handler ────────────────────────────────────────────────────

// Handles all form:* callback queries from the form card keyboard.
// Registered in bot.ts as: bot.callbackQuery(/^form:/, handleFormCallback)
export async function handleFormCallback(ctx: Context): Promise<void> {
  const chatId = ctx.chat!.id;
  const data = ctx.callbackQuery?.data ?? '';

  // ── Execute ────────────────────────────────────────────────────────────────
  // Handled first because it may need show_alert (cannot call answerCallbackQuery twice).
  if (data === 'form:exec') {
    const state = getForm(chatId);
    if (!state) {
      await ctx.answerCallbackQuery();
      await ctx.editMessageText('No active operation. Use a command to start.');
      return;
    }
    if (!isFormComplete(state)) {
      await ctx.answerCallbackQuery({
        text: '⚠️ Fill in all required fields (*) first.',
        show_alert: true,
      });
      return;
    }

    await ctx.answerCallbackQuery();

    const { toolName } = state;
    const toolArgs = buildToolArgs(state);
    cancelForm(chatId);

    const messageId = ctx.callbackQuery!.message!.message_id;
    await ctx.api.editMessageText(chatId, messageId, `⏳ Calling <b>${esc(toolName)}</b>…`, {
      parse_mode: 'HTML',
    });
    await executeTool(ctx, chatId, messageId, toolName, toolArgs);
    return;
  }

  // All other callbacks can be answered immediately
  await ctx.answerCallbackQuery();

  const state = getForm(chatId);

  // ── Cancel ─────────────────────────────────────────────────────────────────
  if (data === 'form:cancel') {
    cancelForm(chatId);
    await ctx.editMessageText('✗ Cancelled.');
    return;
  }

  // ── Back to form view ──────────────────────────────────────────────────────
  // Restores the main form keyboard after the user opens then backs out of
  // a boolean/enum sub-keyboard without selecting a value.
  if (data === 'form:view') {
    if (!state) {
      await ctx.editMessageText('No active operation. Use a command to start.');
      return;
    }
    await ctx.editMessageText(formatForm(state), {
      parse_mode: 'HTML',
      reply_markup: buildFormKeyboard(state),
    });
    return;
  }

  // No active form — likely a cold start wiped the in-memory state
  if (!state) {
    await ctx.editMessageText('Session expired. Please send the command again to start over.');
    return;
  }

  // ── Set field ──────────────────────────────────────────────────────────────
  // form:set:<fieldIndex>
  if (data.startsWith('form:set:')) {
    const fieldIndex = parseInt(data.slice('form:set:'.length), 10);
    const arg = state.args[fieldIndex];
    if (!arg) return;

    if (arg.type === 'boolean') {
      // Swap keyboard inline — no new message
      await ctx.editMessageReplyMarkup({ reply_markup: buildBooleanSubKeyboard(fieldIndex) });
    } else if (arg.enum && arg.enum.length > 0) {
      await ctx.editMessageReplyMarkup({ reply_markup: buildEnumSubKeyboard(fieldIndex, arg.enum) });
    } else {
      // Free-text input: update form card to show "awaiting input" hint, then send ForceReply
      setPendingField(chatId, fieldIndex);
      const updatedState = getForm(chatId)!;
      await ctx.api.editMessageText(chatId, state.formMessageId, formatForm(updatedState), {
        parse_mode: 'HTML',
        reply_markup: buildFormKeyboard(updatedState),
      });

      const typeHint = arg.type !== 'any' ? ` <i>(${arg.type})</i>` : '';
      const descLine = arg.description ? `\n<i>${esc(arg.description)}</i>` : '';
      await ctx.reply(
        `<b>${esc(arg.name)}</b>${descLine}\n\nType the value${typeHint} and send it:`,
        { parse_mode: 'HTML', reply_markup: { force_reply: true, selective: true } },
      );
    }
    return;
  }

  // ── Boolean selected ───────────────────────────────────────────────────────
  // form:bool:<fieldIndex>:1 (true) or form:bool:<fieldIndex>:0 (false)
  if (data.startsWith('form:bool:')) {
    const parts = data.split(':'); // ['form', 'bool', fieldIndex, '1'|'0']
    const fieldIndex = parseInt(parts[2], 10);
    const value = parts[3] === '1';
    const newState = setArg(chatId, fieldIndex, value);
    if (!newState) return;
    await ctx.editMessageText(formatForm(newState), {
      parse_mode: 'HTML',
      reply_markup: buildFormKeyboard(newState),
    });
    return;
  }

  // ── Enum option selected ───────────────────────────────────────────────────
  // form:enum:<fieldIndex>:<enumValueIndex>
  if (data.startsWith('form:enum:')) {
    const parts = data.split(':'); // ['form', 'enum', fieldIndex, enumValueIndex]
    const fieldIndex = parseInt(parts[2], 10);
    const enumIdx = parseInt(parts[3], 10);
    const arg = state.args[fieldIndex];
    if (!arg?.enum) return;
    const value = arg.enum[enumIdx];
    const newState = setArg(chatId, fieldIndex, value);
    if (!newState) return;
    await ctx.editMessageText(formatForm(newState), {
      parse_mode: 'HTML',
      reply_markup: buildFormKeyboard(newState),
    });
    return;
  }
}

// ─── Text reply handler ───────────────────────────────────────────────────────

// Called from bot.on('message:text') when a form is waiting for a text value.
// The user's reply is parsed and the form card is edited to reflect the new value.
export async function handleFormTextReply(ctx: Context): Promise<void> {
  const chatId = ctx.chat!.id;
  const state = getForm(chatId);
  if (!state || state.pendingFieldIndex === null) return;

  const text = ctx.message?.text?.trim() ?? '';
  const fieldIndex = state.pendingFieldIndex;
  const arg = state.args[fieldIndex];
  if (!arg) return;

  const value = parseArgValue(text, arg);
  const newState = setArg(chatId, fieldIndex, value);
  if (!newState) return;

  // Edit the form card (not this reply message) to show the updated value
  await ctx.api.editMessageText(chatId, newState.formMessageId, formatForm(newState), {
    parse_mode: 'HTML',
    reply_markup: buildFormKeyboard(newState),
  });
}

// ─── Tool execution ───────────────────────────────────────────────────────────
//
// Calls the tool and edits messageId with the result.
//
// Read operations (get-*, list-*, etc.): show simulationResult directly.
// Write operations: show a preview + confirmation keyboard. The user must
// confirm before signing and submitting.

async function executeTool(
  ctx: Context,
  chatId: number,
  messageId: number,
  toolName: string,
  args: Record<string, unknown>,
): Promise<void> {
  const client = createClient();
  try {
    const result = await client.call(toolName as never, args as never);

    if (isReadOperation(toolName) || !result.xdr) {
      // ── Read operation: show the result directly ──────────────────────
      await ctx.api.editMessageText(chatId, messageId, formatReadResult(toolName, result), {
        parse_mode: 'HTML',
      });
    } else if (!canSign()) {
      // ── Write operation but no signer key ─────────────────────────────
      await ctx.api.editMessageText(chatId, messageId, formatWriteNoSigner(toolName, result), {
        parse_mode: 'HTML',
      });
    } else {
      // ── Write operation: show preview + confirmation keyboard ─────────
      setPendingSign(chatId, messageId, toolName, result.xdr);
      await ctx.api.editMessageText(chatId, messageId, formatWriteConfirmation(toolName, result), {
        parse_mode: 'HTML',
        reply_markup: buildConfirmKeyboard(),
      });
    }
  } catch (err) {
    let text: string;
    if (err instanceof MCPConnectionError) text = formatConnectionError(err);
    else if (err instanceof MCPToolError) text = formatError(err.toolName, err);
    else text = formatError(toolName, err);

    await ctx.api.editMessageText(chatId, messageId, text, { parse_mode: 'HTML' });
  } finally {
    client.close();
  }
}

// ─── Confirm sign callback ──────────────────────────────────────────────────
//
// Handles confirm:sign and confirm:cancel from the write confirmation keyboard.

export async function handleConfirmCallback(ctx: Context): Promise<void> {
  const chatId = ctx.chat!.id;
  const data = ctx.callbackQuery?.data ?? '';

  if (data === 'confirm:cancel') {
    await ctx.answerCallbackQuery();
    clearPendingSign(chatId);
    await ctx.editMessageText('✗ Transaction cancelled.');
    return;
  }

  if (data === 'confirm:sign') {
    const pending = getPendingSign(chatId);
    if (!pending) {
      await ctx.answerCallbackQuery({ text: 'Session expired. Please try again.', show_alert: true });
      await ctx.editMessageText('Session expired. Send the command again to retry.');
      return;
    }

    await ctx.answerCallbackQuery();
    clearPendingSign(chatId);

    const { messageId, toolName, xdr } = pending;

    await ctx.api.editMessageText(chatId, messageId, '⏳ Signing and submitting…', {
      parse_mode: 'HTML',
    });

    const client = createClient();
    try {
      const submit = await client.signAndSubmit(xdr, {
        signer: secretKeySigner(process.env.SIGNER_SECRET!),
      });
      await ctx.api.editMessageText(chatId, messageId, formatSubmitResult(toolName, submit), {
        parse_mode: 'HTML',
      });
    } catch (err) {
      await ctx.api.editMessageText(chatId, messageId, formatError(toolName, err), {
        parse_mode: 'HTML',
      });
    } finally {
      client.close();
    }
    return;
  }

  await ctx.answerCallbackQuery();
}

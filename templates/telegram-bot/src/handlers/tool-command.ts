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
} from '../conversation.js';
import { esc, formatForm, formatCallResult, formatError, formatConnectionError } from '../formatters.js';
import { buildFormKeyboard, buildBooleanSubKeyboard, buildEnumSubKeyboard } from '../keyboards.js';
import { commandToTool } from '../commands.js';

// ─── Entry point ──────────────────────────────────────────────────────────────

// Called when a user sends a dynamic tool command like /deploy_token.
// Accepts an optional pre-fetched ToolInfo to avoid a redundant listTools() call
// (bot.ts already fetches tools to verify the command exists).
export async function handleToolCommand(
  ctx: Context,
  toolCommand: string,
  prefetchedTool?: ToolInfo,
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
    await ctx.reply(
      `Tool <b>${esc(toolName)}</b> not found on the connected MCP server.\n\nUse /tools to see what's available.`,
      { parse_mode: 'HTML' },
    );
    return;
  }

  // No args → execute immediately (read-only tools like get-admin)
  if (extractArgs(tool).length === 0) {
    const statusMsg = await ctx.reply(`⏳ Calling <b>${esc(toolName)}</b>...`, { parse_mode: 'HTML' });
    await executeTool(ctx, chatId, statusMsg.message_id, toolName, {});
    return;
  }

  // Send loading placeholder, then replace it with the form card
  const formMsg = await ctx.reply('⏳ Loading...', { parse_mode: 'HTML' });

  const state = startForm(chatId, tool, formMsg.message_id);
  if (!state) {
    await ctx.api.editMessageText(chatId, formMsg.message_id, `⏳ Calling <b>${esc(toolName)}</b>...`, {
      parse_mode: 'HTML',
    });
    await executeTool(ctx, chatId, formMsg.message_id, toolName, {});
    return;
  }

  await ctx.api.editMessageText(chatId, formMsg.message_id, formatForm(state), {
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

    const { toolName, collectedArgs } = state;
    cancelForm(chatId);

    const messageId = ctx.callbackQuery!.message!.message_id;
    await ctx.api.editMessageText(chatId, messageId, `⏳ Calling <b>${esc(toolName)}</b>...`, {
      parse_mode: 'HTML',
    });
    await executeTool(ctx, chatId, messageId, toolName, collectedArgs);
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

  const value = parseArgValue(text, arg.type);
  const newState = setArg(chatId, fieldIndex, value);
  if (!newState) return;

  // Edit the form card (not this reply message) to show the updated value
  await ctx.api.editMessageText(chatId, newState.formMessageId, formatForm(newState), {
    parse_mode: 'HTML',
    reply_markup: buildFormKeyboard(newState),
  });
}

// ─── Tool execution ───────────────────────────────────────────────────────────

// Calls the tool and edits messageId in place with the result (or error).
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

    if (result.xdr && canSign()) {
      await ctx.api.editMessageText(chatId, messageId, '⏳ Signing and submitting transaction...');
      const submit = await client.signAndSubmit(result.xdr, {
        signer: secretKeySigner(process.env.SIGNER_SECRET!),
      });
      await ctx.api.editMessageText(chatId, messageId, formatCallResult(toolName, result, submit), {
        parse_mode: 'HTML',
      });
    } else {
      await ctx.api.editMessageText(chatId, messageId, formatCallResult(toolName, result), {
        parse_mode: 'HTML',
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

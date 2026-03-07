// src/handlers/chat.ts
//
// Handles non-command text messages when AI_ENABLED=true.
// Passes the message + conversation history to the AI, then replies.

import type { Context } from 'grammy';
import { chat } from '../ai.js';
import { getHistory, appendHistory } from '../history.js';
import { esc, truncateMessage } from '../formatters.js';

export async function handleChat(ctx: Context): Promise<void> {
  const chatId = ctx.chat?.id;
  const text = ctx.message?.text;
  if (!chatId || !text) return;

  // Show immediate feedback
  const statusMsg = await ctx.reply('💭 Thinking...');

  try {
    const history = getHistory(chatId);
    const reply = await chat(text, history);

    // Update history after successful response
    appendHistory(chatId, 'user', text);
    appendHistory(chatId, 'assistant', reply);

    await ctx.api.editMessageText(statusMsg.chat.id, statusMsg.message_id, truncateMessage(reply));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await ctx.api.editMessageText(
      statusMsg.chat.id,
      statusMsg.message_id,
      `❌ ${esc(msg)}`,
      { parse_mode: 'HTML' },
    );
  }
}

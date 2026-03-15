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

  const statusMsg = await ctx.reply('🤖 Thinking…');

  try {
    const history = await getHistory(chatId);
    const reply = await chat(text, history);

    // Update history after successful response
    await appendHistory(chatId, 'user', text);
    await appendHistory(chatId, 'assistant', reply);

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

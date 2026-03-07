// src/handlers/start.ts

import type { Context } from 'grammy';
import { formatWelcome } from '../formatters.js';

export async function handleStart(ctx: Context): Promise<void> {
  const serverUrl = process.env.MCP_SERVER_URL ?? '(not configured)';
  const aiEnabled = process.env.AI_ENABLED === 'true';
  await ctx.reply(formatWelcome(serverUrl, aiEnabled), { parse_mode: 'HTML' });
}

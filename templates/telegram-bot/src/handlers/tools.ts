// src/handlers/tools.ts

import type { Context } from 'grammy';
import { createClient } from '../mcp.js';
import { formatToolsList, formatConnectionError } from '../formatters.js';

export async function handleTools(ctx: Context): Promise<void> {
  const client = createClient();
  try {
    const tools = await client.listTools();
    await ctx.reply(formatToolsList(tools), { parse_mode: 'HTML' });
  } catch (err) {
    await ctx.reply(formatConnectionError(err), { parse_mode: 'HTML' });
  } finally {
    client.close();
  }
}

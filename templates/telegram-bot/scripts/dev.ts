// scripts/dev.ts
//
// Local development runner using grammy's long polling.
// You don't need a public URL or ngrok — Telegram is polled directly.
//
// Run with: pnpm dev
//
// This script is NOT deployed to Vercel. Only api/webhook.ts is deployed.

import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// ── Load .env FIRST ──────────────────────────────────────────────────────────
// Must happen before any app modules are imported, because bot.ts reads
// TELEGRAM_BOT_TOKEN at module init time. Dynamic imports below ensure this.
const require = createRequire(import.meta.url);
const dotenv = require('dotenv') as { config: (o: { path: string }) => void };
dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), '..', '.env') });

// ── Dynamic imports (after dotenv) ───────────────────────────────────────────
const { bot } = await import('../src/bot.js');
const { createClient } = await import('../src/mcp.js');
const { registerBotCommands } = await import('../src/commands.js');

console.log('[dev] Starting Stellar MCP Telegram Bot (long polling)...');
console.log(`[dev] MCP server : ${process.env.MCP_SERVER_URL ?? '(not set)'}`);
console.log(`[dev] Signing    : ${process.env.SIGNER_SECRET ? 'enabled' : 'disabled (read-only)'}`);
console.log(`[dev] AI mode    : ${process.env.AI_ENABLED === 'true' ? 'enabled' : 'disabled'}`);

process.once('SIGINT', () => { void bot.stop(); });
process.once('SIGTERM', () => { void bot.stop(); });

bot.start({
  onStart: async (info) => {
    console.log(`[dev] Bot @${info.username} is running.`);

    // Register tool commands dynamically — gives users Telegram autocomplete
    const client = createClient();
    try {
      const tools = await client.listTools();
      await registerBotCommands(bot, tools);
      console.log(`[dev] ${tools.length} tool command(s) registered. Send /start to test.`);
    } catch (err) {
      console.warn('[dev] Could not register commands (MCP server unreachable):', String(err));
      console.warn('[dev] Bot will still work — run again when MCP server is up.');
    } finally {
      client.close();
    }
  },
});

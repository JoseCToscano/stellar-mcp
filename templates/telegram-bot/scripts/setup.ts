// scripts/setup.ts
//
// One-time setup script for production deployment.
// Registers tool commands with Telegram AND sets the webhook URL.
//
// Run this AFTER deploying to Vercel:
//   VERCEL_URL=https://your-app.vercel.app pnpm setup
//
// Or to just register commands (no webhook change):
//   pnpm setup

import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// ── Load .env FIRST ──────────────────────────────────────────────────────────
const require = createRequire(import.meta.url);
const dotenv = require('dotenv') as { config: (o: { path: string }) => void };
dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), '..', '.env') });

// ── Dynamic imports (after dotenv) ───────────────────────────────────────────
const { bot } = await import('../src/bot.js');
const { createClient } = await import('../src/mcp.js');
const { registerBotCommands } = await import('../src/commands.js');

async function setup() {
  console.log('[setup] Connecting to MCP server:', process.env.MCP_SERVER_URL);

  // 1. Register dynamic tool commands
  const client = createClient();
  try {
    const tools = await client.listTools();
    console.log(`[setup] Found ${tools.length} tools:`, tools.map((t) => t.name).join(', '));
    await registerBotCommands(bot, tools);
    console.log('[setup] Bot commands registered with Telegram.');
  } finally {
    client.close();
  }

  // 2. Set webhook (if VERCEL_URL is provided)
  const vercelUrl = process.env.VERCEL_URL;
  if (vercelUrl) {
    const webhookUrl = `${vercelUrl.replace(/\/$/, '')}/api/webhook`;
    await bot.api.setWebhook(webhookUrl);
    console.log(`[setup] Webhook set to: ${webhookUrl}`);

    // Verify
    const info = await bot.api.getWebhookInfo();
    console.log('[setup] Webhook info:', {
      url: info.url,
      pending_update_count: info.pending_update_count,
    });
  } else {
    console.log('[setup] VERCEL_URL not set — skipping webhook registration.');
    console.log('[setup] To set webhook manually:');
    console.log(
      `[setup]   VERCEL_URL=https://your-app.vercel.app pnpm setup`,
    );
  }

  process.exit(0);
}

setup().catch((err) => {
  console.error('[setup] Error:', err);
  process.exit(1);
});

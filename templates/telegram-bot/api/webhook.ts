// api/webhook.ts
//
// Vercel serverless function — Telegram sends a POST request here for every
// update when the webhook is configured.
//
// The bot instance is created at module level (shared across warm invocations
// within the same Vercel instance). This is safe because grammy's Bot holds
// only configuration and handler registrations — no per-request state.
//
// The MCPClient is NOT created at module level — see src/mcp.ts for why.

import { webhookCallback } from 'grammy';
import { bot } from '../src/bot.js';

// webhookCallback returns a standard Node.js (req, res) handler.
// Vercel's Node.js runtime picks this up via the default export.
export default webhookCallback(bot, 'https');

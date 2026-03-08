// src/history.ts
//
// Conversation history for AI chat mode.
//
// Two backends, selected automatically by environment:
//
//   1. Vercel KV (persistent) — when KV_REST_API_URL is set
//      Vercel sets this automatically when you link a KV store to your project.
//      History survives cold starts and deploys. 24-hour TTL per chat.
//
//   2. In-memory Map (fallback) — when KV is not configured
//      Resets on cold start. Good for local dev with `pnpm dev`.
//
// To enable persistent history in production:
//   1. Vercel Dashboard → Storage → Create KV Database
//   2. Link it to your project (sets KV_REST_API_URL + KV_REST_API_TOKEN)
//   3. Redeploy. That's it — no code changes needed.
//
// KV errors are caught and logged — the bot degrades gracefully to empty
// history rather than failing the entire chat request.

import type { ModelMessage } from 'ai';

const MAX_MESSAGES = 20;
const KV_TTL = 60 * 60 * 24; // 24 hours
const KV_PREFIX = 'chat:';

// ─── Backend detection ────────────────────────────────────────────────────────

const useKV = Boolean(process.env.KV_REST_API_URL);

// Lazy-loaded KV client to avoid import errors if env is not configured.
// Uses `any` intentionally — @vercel/kv's exact types vary across versions
// and we only use get/setex/del which are stable.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _kv: any = null;

async function loadKV() {
  if (!_kv) {
    const mod = await import('@vercel/kv');
    _kv = mod.kv;
  }
  return _kv;
}

// ─── In-memory fallback ───────────────────────────────────────────────────────

const memStore = new Map<number, ModelMessage[]>();

// ─── Public API ───────────────────────────────────────────────────────────────

export async function getHistory(chatId: number): Promise<ModelMessage[]> {
  if (useKV) {
    try {
      const kv = await loadKV();
      return ((await kv.get(`${KV_PREFIX}${chatId}`)) as ModelMessage[] | null) ?? [];
    } catch (err) {
      console.warn('[history] KV read failed, returning empty history:', err);
      return [];
    }
  }
  return memStore.get(chatId) ?? [];
}

// Note: the KV read-modify-write is not atomic. In practice, Telegram webhook
// serializes updates per chat, so races are unlikely but possible on retries.
export async function appendHistory(
  chatId: number,
  role: 'user' | 'assistant',
  content: string,
): Promise<void> {
  if (useKV) {
    try {
      const kv = await loadKV();
      const history = ((await kv.get(`${KV_PREFIX}${chatId}`)) as ModelMessage[] | null) ?? [];
      history.push({ role, content } as ModelMessage);
      if (history.length > MAX_MESSAGES) history.splice(0, history.length - MAX_MESSAGES);
      await kv.setex(`${KV_PREFIX}${chatId}`, KV_TTL, history);
    } catch (err) {
      console.warn('[history] KV write failed, message not persisted:', err);
    }
    return;
  }

  const history = memStore.get(chatId) ?? [];
  history.push({ role, content } as ModelMessage);
  if (history.length > MAX_MESSAGES) history.splice(0, history.length - MAX_MESSAGES);
  memStore.set(chatId, history);
}

export async function clearHistory(chatId: number): Promise<void> {
  if (useKV) {
    try {
      const kv = await loadKV();
      await kv.del(`${KV_PREFIX}${chatId}`);
    } catch (err) {
      console.warn('[history] KV delete failed:', err);
    }
    return;
  }
  memStore.delete(chatId);
}

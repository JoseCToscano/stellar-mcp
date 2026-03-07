// src/history.ts
//
// In-memory conversation history per Telegram chat ID.
//
// This is intentionally simple for a template — history resets on Vercel
// cold starts. For production with persistent history, replace the Map with
// Vercel KV (Redis):
//
//   import { kv } from '@vercel/kv';
//   async function load(chatId: number) { return kv.get<CoreMessage[]>(`chat:${chatId}`) ?? []; }
//   async function save(chatId: number, msgs: CoreMessage[]) { await kv.setex(`chat:${chatId}`, 86400, msgs); }

import type { ModelMessage } from 'ai';

// Telegram chat ID → conversation messages
const store = new Map<number, ModelMessage[]>();

// Keep the last N messages to stay within model context limits
const MAX_MESSAGES = 20;

export function getHistory(chatId: number): ModelMessage[] {
  return store.get(chatId) ?? [];
}

export function appendHistory(
  chatId: number,
  role: 'user' | 'assistant',
  content: string,
): void {
  const history = store.get(chatId) ?? [];
  history.push({ role, content } as ModelMessage);
  // Prune oldest messages if we exceed the limit
  if (history.length > MAX_MESSAGES) {
    history.splice(0, history.length - MAX_MESSAGES);
  }
  store.set(chatId, history);
}

export function clearHistory(chatId: number): void {
  store.delete(chatId);
}

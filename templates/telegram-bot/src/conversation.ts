// src/conversation.ts
//
// Per-user form state for guided tool calling.
//
// Pattern: single-message "form card" where all parameters are visible at once.
// Users click buttons to set each field (or type for free-text inputs), and the
// same message is edited in place as values are filled in.
//
// Nested object parameters (like deploy-token's `config`) are recursively
// expanded into individual fields. Each field carries a `path` array so we
// can reconstruct the nested object when executing the tool.
//
// State is stored in memory — intentionally ephemeral. Form interactions are
// short-lived (seconds), so persistence across cold starts is not needed.
// (Chat history uses Vercel KV for persistence — see history.ts.)

import {
  extractArgs,
  buildToolArgs as sdkBuildToolArgs,
  parseArgValue,
  isReadOperation,
  argKey,
  type ArgDef,
} from '@stellar-mcp/client';
import type { ToolInfo } from '@stellar-mcp/client';

// Re-export from SDK so callers don't need to import from two places
export { extractArgs, parseArgValue, isReadOperation, argKey };
export type { ArgDef };

// ─── Form state ───────────────────────────────────────────────────────────────

export interface FormState {
  chatId: number;
  toolName: string;
  toolDescription: string;
  args: ArgDef[];                          // All args, flattened from nested schema
  collectedArgs: Record<string, unknown>;  // argKey → value, filled incrementally
  formMessageId: number;                   // The bot message to edit in place
  pendingFieldIndex: number | null;        // Set while awaiting a text reply for this arg index
}

// ─── State store ──────────────────────────────────────────────────────────────

const forms = new Map<number, FormState>();

// ─── Public API ───────────────────────────────────────────────────────────────

export function getForm(chatId: number): FormState | undefined {
  return forms.get(chatId);
}

// Creates a new form state for the tool. Returns null if the tool has no args
// (caller should execute the tool immediately without showing a form).
export function startForm(
  chatId: number,
  tool: ToolInfo,
  formMessageId: number,
): FormState | null {
  const args = extractArgs(tool);
  if (args.length === 0) return null;

  const state: FormState = {
    chatId,
    toolName: tool.name,
    toolDescription: tool.description,
    args,
    collectedArgs: {},
    formMessageId,
    pendingFieldIndex: null,
  };
  forms.set(chatId, state);
  return state;
}

// Records a value for the arg at fieldIndex. Clears pendingFieldIndex.
// Returns updated state, or null if no form is active.
export function setArg(
  chatId: number,
  fieldIndex: number,
  value: unknown,
): FormState | null {
  const state = forms.get(chatId);
  if (!state) return null;
  const arg = state.args[fieldIndex];
  if (!arg) return null;

  const key = argKey(arg);
  if (value === undefined) {
    delete state.collectedArgs[key];
  } else {
    state.collectedArgs[key] = value;
  }
  state.pendingFieldIndex = null;
  forms.set(chatId, state);
  return state;
}

// Marks that we're waiting for a free-text reply for the given arg index.
export function setPendingField(chatId: number, fieldIndex: number): void {
  const state = forms.get(chatId);
  if (!state) return;
  state.pendingFieldIndex = fieldIndex;
  forms.set(chatId, state);
}

export function cancelForm(chatId: number): void {
  forms.delete(chatId);
}

// Returns true when all required args have been filled in.
export function isFormComplete(state: FormState): boolean {
  return state.args
    .filter((a) => a.required)
    .every((a) => Object.prototype.hasOwnProperty.call(state.collectedArgs, argKey(a)));
}

// ─── Build tool args ─────────────────────────────────────────────────────────
//
// Adapts the SDK's buildToolArgs (ArgDef[] + collected map) to FormState.

export function buildToolArgs(state: FormState): Record<string, unknown> {
  return sdkBuildToolArgs(state.args, state.collectedArgs);
}

// ─── Pending sign state ──────────────────────────────────────────────────────
//
// After a write operation is called, we store the XDR here until the user
// confirms they want to sign and submit. This avoids auto-signing.
// Ephemeral — may be lost on serverless cold starts. The confirm handler
// shows "Session expired" gracefully if the state is gone.

export interface PendingSign {
  chatId: number;
  messageId: number;
  toolName: string;
  xdr: string;
}

const pendingSigns = new Map<number, PendingSign>();

export function setPendingSign(
  chatId: number,
  messageId: number,
  toolName: string,
  xdr: string,
): PendingSign {
  const state: PendingSign = { chatId, messageId, toolName, xdr };
  pendingSigns.set(chatId, state);
  return state;
}

export function getPendingSign(chatId: number): PendingSign | undefined {
  return pendingSigns.get(chatId);
}

export function clearPendingSign(chatId: number): void {
  pendingSigns.delete(chatId);
}

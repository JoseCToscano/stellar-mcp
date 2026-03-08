// src/conversation.ts
//
// Per-user form state for guided tool calling.
//
// Pattern: single-message "form card" where all parameters are visible at once.
// Users click buttons to set each field (or type for free-text inputs), and the
// same message is edited in place as values are filled in.
//
// State is stored in memory — intentionally ephemeral. Form interactions are
// short-lived (seconds), so persistence across cold starts is not needed.
// (Chat history uses Vercel KV for persistence — see history.ts.)

import type { ToolInfo } from '@stellar-mcp/client';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ArgDef {
  name: string;
  type: string;       // 'string' | 'number' | 'integer' | 'boolean' | 'object' | 'array' | 'any'
  description: string;
  required: boolean;
  enum?: string[];    // If present, show as inline option buttons
}

export interface FormState {
  chatId: number;
  toolName: string;
  toolDescription: string;
  args: ArgDef[];                          // All args (required first, then optional)
  collectedArgs: Record<string, unknown>;  // name → value, filled incrementally
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

  if (value === undefined) {
    delete state.collectedArgs[arg.name];
  } else {
    state.collectedArgs[arg.name] = value;
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
    .every((a) => Object.prototype.hasOwnProperty.call(state.collectedArgs, a.name));
}

// ─── Pending sign state ──────────────────────────────────────────────────────
//
// After a write operation is called, we store the XDR here until the user
// confirms they want to sign and submit. This avoids auto-signing.

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

// ─── Read vs Write heuristic ────────────────────────────────────────────────
//
// Soroban simulates ALL contract calls, so both read and write tools return XDR.
// We use the tool name to determine intent: read-only tools start with
// well-known prefixes (get-, list-, query-, etc.).

const READ_PREFIXES = /^(get|list|query|fetch|find|search|is|has|check|count|show|view|read)/i;

export function isReadOperation(toolName: string): boolean {
  // Normalize: "get-admin" → "getadmin", "get_admin" → "getadmin"
  const normalized = toolName.replace(/[-_]/g, '');
  return READ_PREFIXES.test(normalized);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Extracts ArgDef[] from a tool's inputSchema (JSON Schema format).
// Required args come first so they're prominent in the form; optional args follow.
export function extractArgs(tool: ToolInfo): ArgDef[] {
  const props = (tool.inputSchema.properties ?? {}) as Record<
    string,
    { type?: unknown; description?: string; enum?: unknown[] }
  >;

  if (!props || Object.keys(props).length === 0) return [];

  const required = (tool.inputSchema.required as string[] | undefined) ?? [];

  const makeArg = (name: string): ArgDef => {
    const def = props[name] ?? {};
    return {
      name,
      type: typeof def.type === 'string' ? def.type : 'any',
      description: def.description ?? '',
      required: required.includes(name),
      enum: Array.isArray(def.enum) ? (def.enum as string[]) : undefined,
    };
  };

  const requiredArgs = required.map(makeArg);
  const optionalArgs = Object.keys(props)
    .filter((k) => !required.includes(k))
    .map(makeArg);

  return [...requiredArgs, ...optionalArgs];
}

// Parses a user's typed reply into the correct value type for the arg.
export function parseArgValue(value: string, type: string): unknown {
  const trimmed = value.trim();
  switch (type) {
    case 'number':
    case 'integer': {
      const n = Number(trimmed);
      return isNaN(n) ? trimmed : n;
    }
    case 'boolean':
      return (
        trimmed.toLowerCase() === 'true' ||
        trimmed === '1' ||
        trimmed.toLowerCase() === 'yes'
      );
    case 'object':
    case 'array': {
      try {
        return JSON.parse(trimmed);
      } catch {
        return trimmed; // Let the server validate
      }
    }
    default:
      return trimmed;
  }
}

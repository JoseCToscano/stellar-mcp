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

import type { ToolInfo } from '@stellar-mcp/client';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ArgDef {
  name: string;         // Display name (e.g., "admin", "decimals")
  path: string[];       // Full path for nested reconstruction (e.g., ["config", "admin"])
  type: string;         // 'string' | 'number' | 'integer' | 'boolean' | 'object' | 'array' | 'any'
  description: string;
  required: boolean;
  enum?: string[];      // If present, show as inline option buttons
  group?: string;       // Section header for nested object groups (e.g., "config")
  nullable?: boolean;   // If true, empty input → null
  unionTag?: boolean;   // If true, value is wrapped as { tag: value } during arg reconstruction
}

export interface FormState {
  chatId: number;
  toolName: string;
  toolDescription: string;
  args: ArgDef[];                          // All args, flattened from nested schema
  collectedArgs: Record<string, unknown>;  // argKey → value, filled incrementally
  formMessageId: number;                   // The bot message to edit in place
  pendingFieldIndex: number | null;        // Set while awaiting a text reply for this arg index
}

// ─── Arg key ──────────────────────────────────────────────────────────────────
// Unique key for each arg, derived from its path. Used as key in collectedArgs.
// Assumes property names don't contain dots — holds for all Stellar MCP schemas.

export function argKey(arg: ArgDef): string {
  return arg.path.join('.');
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

// ─── Build tool args ────────────────────────────────────────────────────────
//
// Reconstructs the nested object structure from the flat collectedArgs map.
// e.g., { "deployer": "G...", "config.admin": "G...", "config.decimals": 7 }
// becomes { deployer: "G...", config: { admin: "G...", decimals: 7 } }

export function buildToolArgs(state: FormState): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const arg of state.args) {
    const key = argKey(arg);
    if (!Object.prototype.hasOwnProperty.call(state.collectedArgs, key)) continue;

    let value = state.collectedArgs[key];

    // Wrap union tag values: "Allowlist" → { tag: "Allowlist" }
    if (arg.unionTag && typeof value === 'string') {
      value = { tag: value };
    }

    // Navigate to the correct nesting level and set the value
    let current = result;
    for (let i = 0; i < arg.path.length - 1; i++) {
      const segment = arg.path[i];
      if (!current[segment] || typeof current[segment] !== 'object') {
        current[segment] = {};
      }
      current = current[segment] as Record<string, unknown>;
    }
    current[arg.path[arg.path.length - 1]] = value;
  }

  return result;
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

// ─── Read vs Write heuristic ────────────────────────────────────────────────
//
// Soroban simulates ALL contract calls, so both read and write tools return XDR.
// We use the tool name to determine intent: read-only tools start with
// well-known prefixes followed by a separator (get-admin, list_tokens, etc.).
//
// The regex tests the original name (not normalized) and requires a separator
// or end-of-string after the prefix. This prevents false positives like
// "issue-tokens" matching "is" or "isolate-account" matching "is".

const READ_PREFIX = /^(get|list|query|fetch|find|search|is|has|check|count|show|view|read)[-_]|^(get|list|query|fetch|find|search|is|has|check|count|show|view|read)$/i;

export function isReadOperation(toolName: string): boolean {
  return READ_PREFIX.test(toolName);
}

// ─── Schema helpers ─────────────────────────────────────────────────────────

// JSON Schema property shape (loose — MCP servers vary)
interface SchemaProp {
  type?: unknown;
  description?: string;
  enum?: unknown[];
  properties?: Record<string, SchemaProp>;
  required?: string[];
  oneOf?: Array<{ properties?: Record<string, { const?: string }> }>;
  anyOf?: Array<{ properties?: Record<string, { const?: string }> }>;
}

// Resolves type from JSON Schema, handling nullable (["string", "null"]).
function resolveType(typeDef: unknown): { type: string; nullable: boolean } {
  if (Array.isArray(typeDef)) {
    const nonNull = typeDef.filter((t: unknown) => t !== 'null');
    return {
      type: (nonNull[0] as string) ?? 'any',
      nullable: typeDef.includes('null'),
    };
  }
  return { type: typeof typeDef === 'string' ? typeDef : 'any', nullable: false };
}

// Detects discriminated unions (oneOf/anyOf with { tag: "Value" } pattern).
// Returns the tag values as enum options, or null if not a union.
function extractUnionTags(prop: SchemaProp): string[] | null {
  const variants = prop.oneOf ?? prop.anyOf;
  if (!variants || variants.length === 0) return null;

  // Only treat as a discriminated union if ALL variants have a tag.const.
  // Partial matches could mean this is a different kind of union.
  const tags: string[] = [];
  for (const variant of variants) {
    const tagConst = variant.properties?.tag?.const;
    if (typeof tagConst !== 'string') return null;
    tags.push(tagConst);
  }
  return tags.length > 0 ? tags : null;
}

// ─── extractArgs ────────────────────────────────────────────────────────────
//
// Recursively walks the tool's inputSchema and produces a flat list of ArgDef.
// Nested objects (type: "object" with properties) are expanded into individual
// fields with path arrays for reconstruction. Union types with tag discriminators
// become enum fields.

export function extractArgs(tool: ToolInfo): ArgDef[] {
  const schema = tool.inputSchema as { properties?: Record<string, SchemaProp>; required?: string[] };
  const props = schema.properties;
  if (!props || Object.keys(props).length === 0) return [];

  const topRequired = schema.required ?? [];
  return flattenProperties(props, topRequired, [], undefined, true);
}

const MAX_DEPTH = 5;

function flattenProperties(
  props: Record<string, SchemaProp>,
  required: string[],
  parentPath: string[],
  group: string | undefined,
  parentRequired: boolean,
  depth: number = 0,
): ArgDef[] {
  if (depth > MAX_DEPTH) return [];

  const reqArgs: ArgDef[] = [];
  const optArgs: ArgDef[] = [];

  for (const [name, def] of Object.entries(props)) {
    const path = [...parentPath, name];
    const isRequired = parentRequired && required.includes(name);
    const { type, nullable } = resolveType(def.type);

    // Check for discriminated union (oneOf with tag pattern)
    const unionTags = extractUnionTags(def);
    if (unionTags) {
      const arg: ArgDef = {
        name,
        path,
        type: 'enum',
        description: def.description ?? '',
        required: isRequired,
        enum: unionTags,
        group,
        unionTag: true,
      };
      (isRequired ? reqArgs : optArgs).push(arg);
      continue;
    }

    // Nested object with known properties → recursively expand
    if (type === 'object' && def.properties && Object.keys(def.properties).length > 0) {
      const nestedRequired = def.required ?? [];
      const nested = flattenProperties(def.properties, nestedRequired, path, name, isRequired, depth + 1);
      reqArgs.push(...nested.filter((a) => a.required));
      optArgs.push(...nested.filter((a) => !a.required));
      continue;
    }

    // Regular field (or object without known properties → fallback to JSON input)
    const arg: ArgDef = {
      name,
      path,
      type,
      description: def.description ?? '',
      required: isRequired,
      enum: Array.isArray(def.enum) ? (def.enum as string[]) : undefined,
      group,
      nullable: nullable || undefined,
    };
    (isRequired ? reqArgs : optArgs).push(arg);
  }

  return [...reqArgs, ...optArgs];
}

// ─── parseArgValue ──────────────────────────────────────────────────────────
//
// Parses a user's typed reply into the correct value type for the arg.

export function parseArgValue(value: string, arg: ArgDef): unknown {
  const trimmed = value.trim();

  // Empty input for nullable fields → null
  if (trimmed === '' && arg.nullable) return null;

  switch (arg.type) {
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

// src/schema.ts
//
// Schema utilities for building UIs on top of MCP tool definitions.
//
// These helpers operate purely on the JSON Schema from `ToolInfo.inputSchema`
// and are presentation-layer agnostic — equally useful for Telegram bots,
// React forms, CLIs, or any other interface that needs to surface tool params.

import type { ToolInfo } from './types.js';

// ─── Types ────────────────────────────────────────────────────────────────────

/** Flat representation of a single tool argument, ready for UI rendering. */
export interface ArgDef {
  /** Display name (e.g. "admin", "decimals") */
  name: string;
  /** Full path for nested reconstruction (e.g. ["config", "admin"]) */
  path: string[];
  /** 'string' | 'number' | 'integer' | 'boolean' | 'object' | 'array' | 'enum' | 'any' */
  type: string;
  description: string;
  required: boolean;
  /** Present for enum / discriminated union fields — show as option buttons */
  enum?: string[];
  /** Section header for nested object groups (e.g. "config") */
  group?: string;
  /** If true, empty input should produce null */
  nullable?: boolean;
  /** If true, value must be wrapped as { tag: value } when building args */
  unionTag?: boolean;
}

// ─── Read vs Write heuristic ─────────────────────────────────────────────────
//
// Soroban simulates ALL contract calls, so both read and write tools return XDR.
// We use the tool name to determine intent: read-only tools start with
// well-known prefixes followed by a separator (get-admin, list_tokens, etc.).
//
// The regex tests the original name (not normalized) and requires a separator
// or end-of-string after the prefix, preventing false positives like
// "issue-tokens" matching "is" or "isolate-account" matching "is".

const READ_PREFIX =
  /^(get|list|query|fetch|find|search|is|has|check|count|show|view|read)[-_]|^(get|list|query|fetch|find|search|is|has|check|count|show|view|read)$/i;

/**
 * Heuristic: returns true if the tool name suggests a read-only operation.
 *
 * @example
 * isReadOperation('get-admin')     // true
 * isReadOperation('list_tokens')   // true
 * isReadOperation('is_paused')     // true
 * isReadOperation('deploy-token')  // false
 * isReadOperation('transfer')      // false
 */
export function isReadOperation(toolName: string): boolean {
  return READ_PREFIX.test(toolName);
}

// ─── extractArgs ─────────────────────────────────────────────────────────────

/** Unique key for an arg derived from its path. Used as key in collected values. */
export function argKey(arg: ArgDef): string {
  return arg.path.join('.');
}

/**
 * Flatten a tool's `inputSchema` into a sorted, display-ready list of `ArgDef`.
 *
 * Nested objects are recursively expanded into individual fields with `path`
 * arrays for reconstruction. Discriminated unions (`oneOf`/`anyOf` with
 * `{ tag: "Value" }` pattern) become enum fields with `unionTag: true`.
 *
 * Required args come before optional args at every nesting level.
 */
export function extractArgs(tool: ToolInfo): ArgDef[] {
  const schema = tool.inputSchema as {
    properties?: Record<string, SchemaProp>;
    required?: string[];
  };
  const props = schema.properties;
  if (!props || Object.keys(props).length === 0) return [];

  const topRequired = schema.required ?? [];
  return flattenProperties(props, topRequired, [], undefined, true);
}

// ─── buildToolArgs ───────────────────────────────────────────────────────────

/**
 * Reconstruct a nested args object from a flat key→value map.
 *
 * @example
 * // Flat collected values:
 * { "deployer": "G...", "config.admin": "G...", "config.decimals": 7 }
 * // Produces:
 * { deployer: "G...", config: { admin: "G...", decimals: 7 } }
 */
export function buildToolArgs(
  args: ArgDef[],
  collected: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const arg of args) {
    const key = argKey(arg);
    if (!Object.prototype.hasOwnProperty.call(collected, key)) continue;

    let value = collected[key];

    // Wrap discriminated union tag values: "Allowlist" → { tag: "Allowlist" }
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

// ─── parseArgValue ───────────────────────────────────────────────────────────

/**
 * Coerce a user-typed string into the correct JS type for the given arg.
 *
 * - Empty string + nullable arg → null
 * - 'number' / 'integer' → Number (falls back to string if not parseable)
 * - 'boolean' → true for "true", "1", "yes"; false otherwise
 * - 'object' / 'array' → JSON.parse (falls back to raw string)
 * - anything else → trimmed string
 */
export function parseArgValue(value: string, arg: ArgDef): unknown {
  const trimmed = value.trim();

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
        return trimmed;
      }
    }
    default:
      return trimmed;
  }
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

interface SchemaProp {
  type?: unknown;
  description?: string;
  enum?: unknown[];
  properties?: Record<string, SchemaProp>;
  required?: string[];
  oneOf?: Array<{ properties?: Record<string, { const?: string }> }>;
  anyOf?: Array<{ properties?: Record<string, { const?: string }> }>;
}

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

function extractUnionTags(prop: SchemaProp): string[] | null {
  const variants = prop.oneOf ?? prop.anyOf;
  if (!variants || variants.length === 0) return null;

  const tags: string[] = [];
  for (const variant of variants) {
    const tagConst = variant.properties?.tag?.const;
    if (typeof tagConst !== 'string') return null;
    tags.push(tagConst);
  }
  return tags.length > 0 ? tags : null;
}

const MAX_DEPTH = 5;

function flattenProperties(
  props: Record<string, SchemaProp>,
  required: string[],
  parentPath: string[],
  group: string | undefined,
  parentRequired: boolean,
  depth = 0,
): ArgDef[] {
  if (depth > MAX_DEPTH) return [];

  const reqArgs: ArgDef[] = [];
  const optArgs: ArgDef[] = [];

  for (const [name, def] of Object.entries(props)) {
    const path = [...parentPath, name];
    const isRequired = parentRequired && required.includes(name);
    const { type, nullable } = resolveType(def.type);

    // Discriminated union (oneOf/anyOf with { tag: "Value" } pattern)
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

    // Nested object with known properties → recurse
    if (type === 'object' && def.properties && Object.keys(def.properties).length > 0) {
      const nestedRequired = def.required ?? [];
      const nested = flattenProperties(
        def.properties,
        nestedRequired,
        path,
        name,
        isRequired,
        depth + 1,
      );
      reqArgs.push(...nested.filter((a) => a.required));
      optArgs.push(...nested.filter((a) => !a.required));
      continue;
    }

    // Regular field (or opaque object → JSON input)
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

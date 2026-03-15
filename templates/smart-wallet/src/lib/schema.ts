// src/lib/schema.ts
//
// Copied from templates/telegram-bot/src/conversation.ts (issue #8 — templates are standalone).
// Provides schema utilities for extracting, building, and parsing tool arguments.

import type { ToolInfo } from '@stellar-mcp/client';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ArgDef {
  name: string;         // Display name (e.g. "admin", "decimals")
  path: string[];       // Full path for nested reconstruction (e.g. ["config", "admin"])
  type: string;         // 'string' | 'number' | 'integer' | 'boolean' | 'object' | 'array' | 'any' | 'enum'
  description: string;
  required: boolean;
  enum?: string[];      // If present, show as select/radio buttons
  group?: string;       // Section header for nested object groups (e.g. "config")
  nullable?: boolean;   // If true, empty input → null
  unionTag?: boolean;   // If true, value is wrapped as { tag: value } during arg reconstruction
}

// ─── Build tool args ──────────────────────────────────────────────────────────
//
// Reconstructs the nested object structure from the flat collected values map.
// e.g., { "deployer": "G...", "config.admin": "G...", "config.decimals": 7 }
// becomes { deployer: "G...", config: { admin: "G...", decimals: 7 } }

export function buildToolArgs(
  args: ArgDef[],
  collected: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const arg of args) {
    const key = arg.path.join('.');
    if (!Object.prototype.hasOwnProperty.call(collected, key)) continue;

    let value = collected[key];

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

// ─── parseArgValue ────────────────────────────────────────────────────────────
//
// Parses a user's string input into the correct value type for the arg.

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

// ─── isReadOperation ──────────────────────────────────────────────────────────
//
// Soroban simulates ALL contract calls, so both read and write tools return XDR.
// We use the tool name to determine intent: read-only tools start with
// well-known prefixes followed by a separator.

const READ_PREFIX =
  /^(get|list|query|fetch|find|search|is|has|check|count|show|view|read)[-_]|^(get|list|query|fetch|find|search|is|has|check|count|show|view|read)$/i;

export function isReadOperation(toolName: string): boolean {
  return READ_PREFIX.test(toolName);
}

// ─── Schema helpers ───────────────────────────────────────────────────────────

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

// ─── extractArgs ──────────────────────────────────────────────────────────────
//
// Recursively walks the tool's inputSchema and produces a flat list of ArgDef.

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

    // Check for discriminated union
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

    // Regular field
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

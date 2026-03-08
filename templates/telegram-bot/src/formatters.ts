// src/formatters.ts
//
// All Telegram message text is produced here. Keeping formatting out of
// handlers makes it easy to iterate on wording without touching bot logic.
//
// Parse mode: HTML throughout.
// MarkdownV2 requires escaping nearly every punctuation character, making
// dynamic content (Stellar addresses, JSON, contract names) very fragile.
// HTML only requires escaping <, >, and &.

import type { ToolInfo, CallResult, SubmitResult } from '@stellar-mcp/client';
import type { FormState } from './conversation.js';
import { argKey } from './conversation.js';

// ─── HTML escaping & limits ───────────────────────────────────────────────────

export function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Telegram enforces a 4096-char limit on message text.
// Truncate safely so callers never hit a 400 error.
const TELEGRAM_MSG_LIMIT = 4096;
const TRUNCATION_SUFFIX = '\n\n<i>… (truncated)</i>';

export function truncateMessage(text: string): string {
  if (text.length <= TELEGRAM_MSG_LIMIT) return text;
  return text.slice(0, TELEGRAM_MSG_LIMIT - TRUNCATION_SUFFIX.length) + TRUNCATION_SUFFIX;
}

// ─── Shared ──────────────────────────────────────────────────────────────────

const LINE = '━━━━━━━━━━━━━━━━━━━━━━━━━━━━';

// ─── Markdown → clean text ───────────────────────────────────────────────────
//
// MCP tool descriptions contain Rust-doc markdown:
//   "Construct and simulate a deploy_token transaction.\n\n# Arguments\n\n* `deployer` - ..."
//
// The form card already shows every parameter as an interactive field, so the
// # Arguments / # Returns / # Events sections are redundant. We extract the
// first paragraph (the actual description) and lightly convert any remaining
// markdown to Telegram HTML.

// Returns HTML-safe text — already escaped, ready to embed in a message.
export function cleanDescription(raw: string): string {
  // Cut at the first markdown heading (# Arguments, # Returns, # Events, etc.)
  const headingIdx = raw.search(/\n#\s/);
  const text = headingIdx !== -1 ? raw.slice(0, headingIdx) : raw;

  // Escape HTML entities first, then apply formatting
  return esc(text)
    // Strip leading "Construct and simulate a <fn> transaction. " boilerplate
    .replace(/^Construct and simulate a \S+ transaction\.\s*/i, '')
    // Convert `code` to <code>code</code> (backticks are safe after escaping)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // Strip leftover markdown bullet markers (* or -)
    .replace(/^\s*[*\-]\s+/gm, '• ')
    // Strip markdown heading markers that didn't get caught above
    .replace(/^#+\s*/gm, '')
    // Collapse multiple blank lines
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ─── /start ───────────────────────────────────────────────────────────────────

export function formatWelcome(serverUrl: string, aiEnabled: boolean): string {
  const aiLine = aiEnabled
    ? '🤖 AI mode is <b>on</b> — type naturally to interact.'
    : '💡 <code>AI_ENABLED=true</code> + API key → natural language chat';

  return [
    '⚡ <b>Stellar MCP Bot</b>',
    LINE,
    '',
    `🔗 <code>${esc(serverUrl)}</code>`,
    '',
    '/tools — list contract functions',
    '/call  — browse &amp; execute interactively',
    '',
    aiLine,
  ].join('\n');
}

// ─── /tools ───────────────────────────────────────────────────────────────────

export function formatToolsList(tools: ToolInfo[]): string {
  if (tools.length === 0) {
    return 'No tools found on the connected MCP server.';
  }

  // kebab-case → underscore for Telegram command format
  const toCmd = (name: string) => name.replace(/-/g, '_').toLowerCase();

  const lines = tools.map((t) => {
    const hasArgs = Object.keys(
      (t.inputSchema.properties ?? {}) as Record<string, unknown>,
    ).length > 0;
    const icon = hasArgs ? '📝' : '👁';
    let desc = cleanDescription(t.description || 'No description');
    // First sentence only for the compact list view
    const sentenceEnd = desc.search(/\.\s/);
    if (sentenceEnd !== -1) desc = desc.slice(0, sentenceEnd + 1);
    if (desc.length > 80) desc = desc.slice(0, 78) + '…';
    // Show as clickable /command — Telegram auto-links these
    return `${icon} /${toCmd(t.name)}\n     <i>${desc || esc(t.name)}</i>`;
  });

  return truncateMessage([
    `📋 <b>${tools.length} tool${tools.length === 1 ? '' : 's'} available</b>`,
    LINE,
    '',
    ...lines,
    '',
    `<i>👁 = read-only  ·  📝 = requires input</i>`,
    '<i>Tap any command to run it</i>',
  ].join('\n'));
}

// ─── Read result ─────────────────────────────────────────────────────────────
//
// Shows the simulationResult (the actual contract return value) for read ops.
// Both read and write Soroban calls return XDR, but for reads we only care
// about the simulationResult — the XDR is never submitted.

export function formatReadResult(toolName: string, result: CallResult): string {
  return truncateMessage([
    `👁 <b>${esc(toolName)}</b>`,
    LINE,
    '',
    formatResultData(result),
  ].join('\n'));
}

// ─── Write confirmation ─────────────────────────────────────────────────────
//
// Shows a preview of the write operation result and waits for user confirmation
// before signing. Shown with a "Sign & Submit" keyboard.

export function formatWriteConfirmation(toolName: string, result: CallResult): string {
  const lines = [
    `✍️ <b>${esc(toolName)}</b>`,
    LINE,
    '',
  ];

  // Show simulation result as preview
  const preview = result.simulationResult;
  if (preview !== null && preview !== undefined) {
    lines.push('<b>Preview:</b>');
    const json = JSON.stringify(preview, null, 2);
    const truncated = json.length > 400 ? json.slice(0, 400) + '…' : json;
    lines.push(`<code>${esc(truncated)}</code>`);
    lines.push('');
  }

  lines.push('<i>Sign and submit this transaction?</i>');

  return lines.join('\n');
}

// ─── Write confirmation (no signer key) ─────────────────────────────────────

export function formatWriteNoSigner(toolName: string, result: CallResult): string {
  const lines = [
    `📄 <b>${esc(toolName)}</b> — unsigned transaction`,
    LINE,
    '',
  ];

  // Show simulation result
  const preview = result.simulationResult;
  if (preview !== null && preview !== undefined) {
    lines.push('<b>Preview:</b>');
    const json = JSON.stringify(preview, null, 2);
    const truncated = json.length > 400 ? json.slice(0, 400) + '…' : json;
    lines.push(`<code>${esc(truncated)}</code>`);
    lines.push('');
  }

  lines.push('<b>XDR:</b>');
  lines.push(`<code>${esc((result.xdr ?? '').slice(0, 200))}…</code>`);
  lines.push('');
  lines.push('💡 <i>Set SIGNER_SECRET to enable signing.</i>');

  return lines.join('\n');
}

// ─── Submitted result ────────────────────────────────────────────────────────

export function formatSubmitResult(toolName: string, submitResult: SubmitResult): string {
  const networkPassphrase = process.env.NETWORK_PASSPHRASE ?? '';
  const isMainnet = networkPassphrase.includes('Public Global');
  const explorerBase = isMainnet
    ? 'https://stellar.expert/explorer/public'
    : 'https://stellar.expert/explorer/testnet';

  const ok = submitResult.status === 'SUCCESS';
  const lines = [
    ok ? '✅ <b>Transaction Submitted</b>' : '❌ <b>Transaction Failed</b>',
    LINE,
    '',
    `<b>Hash</b>`,
    `<code>${esc(submitResult.hash)}</code>`,
    '',
    `<b>Status:</b> ${esc(submitResult.status)}`,
  ];
  if (submitResult.hash) {
    lines.push('');
    lines.push(`🔗 <a href="${explorerBase}/tx/${submitResult.hash}">View on Stellar Expert</a>`);
  }
  return lines.join('\n');
}

export function formatError(toolName: string, err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  return [
    `❌ <b>Error</b> — ${esc(toolName)}`,
    LINE,
    '',
    `<code>${esc(msg)}</code>`,
  ].join('\n');
}

export function formatConnectionError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  return [
    '❌ <b>Connection Failed</b>',
    LINE,
    '',
    `<code>${esc(msg)}</code>`,
    '',
    '<i>Check that MCP_SERVER_URL is correct and the server is running.</i>',
  ].join('\n');
}

// ─── Result data formatting ──────────────────────────────────────────────────
//
// Renders contract return values as clean Telegram messages. Handles:
//   - null/undefined → "No data returned."
//   - simple scalars → direct display
//   - Stellar addresses → copyable <code> blocks
//   - { tag: "Value" } → unwrapped to just "Value" (Soroban enum pattern)
//   - arrays of objects → numbered cards with key-value pairs
//   - objects → key-value pairs
//
// Dynamic: works with any contract shape, not hardcoded to specific schemas.

function formatResultData(result: CallResult): string {
  // simulationResult is the contract's actual return value.
  // null means the contract returned void (e.g., no pending admin).
  // Only fall back to data if simulationResult is truly absent (undefined).
  const value = result.simulationResult !== undefined
    ? result.simulationResult
    : result.data;

  if (value === null || value === undefined) return '<i>No data returned.</i>';

  return renderValue(value);
}

// ─── Recursive value renderer ────────────────────────────────────────────────

function renderValue(value: unknown): string {
  if (value === null || value === undefined) return '<i>null</i>';

  // Scalars
  if (typeof value === 'string') return renderString(value);
  if (typeof value === 'number') return `<b>${value}</b>`;
  if (typeof value === 'boolean') return `<b>${value}</b>`;

  // Soroban enum: { tag: "Pausable" } → "Pausable"
  const tag = unwrapTag(value);
  if (tag !== null) return esc(tag);

  // Array
  if (Array.isArray(value)) return renderArray(value);

  // Object
  if (typeof value === 'object') return renderObject(value as Record<string, unknown>);

  return `<code>${esc(String(value))}</code>`;
}

function renderString(s: string): string {
  // Stellar address (56 chars, starts with G or C) — show as copyable code
  if (/^[GC][A-Z2-7]{55}$/.test(s)) {
    return `<code>${esc(s)}</code>`;
  }
  // Long strings — wrap in code
  if (s.length > 60) return `<code>${esc(s)}</code>`;
  return esc(s);
}

// Unwrap Soroban enum pattern: { tag: "Value" } → "Value"
function unwrapTag(value: unknown): string | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj);
  if (keys.length === 1 && keys[0] === 'tag' && typeof obj.tag === 'string') {
    return obj.tag;
  }
  return null;
}

function renderObject(obj: Record<string, unknown>): string {
  const lines: string[] = [];
  for (const [key, val] of Object.entries(obj)) {
    lines.push(`<b>${esc(key)}</b>  ${renderInlineValue(val)}`);
  }
  return lines.join('\n');
}

// Renders a value inline (for key-value pairs) — keeps it on one line
function renderInlineValue(value: unknown): string {
  if (value === null || value === undefined) return '<i>null</i>';
  if (typeof value === 'string') return renderString(value);
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);

  const tag = unwrapTag(value);
  if (tag !== null) return esc(tag);

  // Nested object/array: compact JSON
  const json = JSON.stringify(value);
  const display = json.length > 50 ? json.slice(0, 48) + '…' : json;
  return `<code>${esc(display)}</code>`;
}

function renderArray(arr: unknown[]): string {
  if (arr.length === 0) return '<i>Empty list.</i>';

  const lines: string[] = [];
  lines.push(`📋 <b>${arr.length} result${arr.length === 1 ? '' : 's'}</b>`);
  lines.push('');

  // Array of objects: numbered cards
  const isObjectArray = arr.every(
    (item) => typeof item === 'object' && item !== null && !Array.isArray(item),
  );

  if (isObjectArray) {
    const MAX_ITEMS = 5;
    const items = arr.slice(0, MAX_ITEMS) as Record<string, unknown>[];

    items.forEach((item, i) => {
      // Use a "name", "label", or "symbol" field as the card title
      const label = findLabel(item);
      lines.push(`<b>${i + 1}.</b>${label ? ` ${esc(label)}` : ''}`);

      for (const [key, val] of Object.entries(item)) {
        // Truncate Stellar addresses in list context
        const rendered = renderInlineValue(val);
        lines.push(`   <b>${esc(key)}</b>  ${rendered}`);
      }

      if (i < items.length - 1) lines.push('');
    });

    if (arr.length > MAX_ITEMS) {
      lines.push('');
      lines.push(`<i>… and ${arr.length - MAX_ITEMS} more</i>`);
    }
  } else {
    // Array of primitives
    const MAX_ITEMS = 10;
    arr.slice(0, MAX_ITEMS).forEach((item) => {
      lines.push(`• ${renderInlineValue(item)}`);
    });
    if (arr.length > MAX_ITEMS) {
      lines.push(`<i>… and ${arr.length - MAX_ITEMS} more</i>`);
    }
  }

  return lines.join('\n');
}

// Finds a human-readable label field in an object for card titles
function findLabel(obj: Record<string, unknown>): string | null {
  for (const key of ['name', 'label', 'title', 'symbol', 'id']) {
    if (typeof obj[key] === 'string' && obj[key]) {
      return obj[key] as string;
    }
  }
  return null;
}

// Converts a JSON Schema inputSchema into human-readable bullet lines.
// Handles the shapes produced by Stellar MCP servers:
//   {}                                  → no args (read-only)
//   { type: 'object', properties: {} } → empty schema
//   { properties: { name: {...} } }    → standard
//   { type: 'object', required: [...], properties: { ... } } → full schema
export function buildArgPreview(inputSchema: Record<string, unknown>): string[] {
  const props = inputSchema.properties as
    | Record<string, { type?: unknown; description?: string }>
    | undefined;

  if (!props || Object.keys(props).length === 0) return [];

  const required = (inputSchema.required as string[] | undefined) ?? [];

  return Object.entries(props).map(([name, def]) => {
    const type = typeof def.type === 'string' ? def.type : 'any';
    const opt = required.includes(name) ? '' : ' (optional)';
    const desc = def.description ? ` — ${def.description}` : '';
    return `  • <b>${esc(name)}</b> <i>${esc(type)}${opt}</i>${esc(desc)}`;
  });
}

// Builds a compact example JSON string from the schema using placeholder values.
export function buildExampleJson(inputSchema: Record<string, unknown>): string {
  const props = inputSchema.properties as
    | Record<string, { type?: unknown }>
    | undefined;

  if (!props || Object.keys(props).length === 0) return '';

  const example: Record<string, unknown> = {};
  for (const [name, def] of Object.entries(props)) {
    switch (def.type) {
      case 'string':
        example[name] = name.toLowerCase().includes('address') ? 'GABC...' : 'value';
        break;
      case 'number':
      case 'integer':
        example[name] = 0;
        break;
      case 'boolean':
        example[name] = true;
        break;
      case 'array':
        example[name] = [];
        break;
      case 'object':
        example[name] = {};
        break;
      default:
        example[name] = null;
    }
  }
  return JSON.stringify(example);
}

// ─── Form card ────────────────────────────────────────────────────────────────
//
// Minimal message text + rich inline keyboard (Banana Gun pattern).
// Message shows: header, description, filled values summary, progress.
// Keyboard shows: all fields with ✎/✓ status + section divider buttons.
// This avoids duplicating the field list in both text and keyboard.

export function formatForm(state: FormState): string {
  const lines: string[] = [
    `🔧 <b>${esc(state.toolName)}</b>`,
  ];

  if (state.toolDescription) {
    const desc = cleanDescription(state.toolDescription);
    if (desc) {
      lines.push(`<i>${desc}</i>`);
    }
  }

  lines.push(LINE);

  // Show filled values as a clean summary
  const filledEntries: string[] = [];
  for (const arg of state.args) {
    const key = argKey(arg);
    if (!Object.prototype.hasOwnProperty.call(state.collectedArgs, key)) continue;
    const val = state.collectedArgs[key];
    const str = val === null ? 'null' : typeof val === 'string' ? val : JSON.stringify(val);
    const display = str.length > 40 ? str.slice(0, 38) + '…' : str;
    filledEntries.push(`<b>${esc(arg.name)}</b>  <code>${esc(display)}</code>`);
  }

  if (filledEntries.length > 0) {
    lines.push('');
    lines.push(...filledEntries);
  }

  lines.push('');

  if (state.pendingFieldIndex !== null) {
    const arg = state.args[state.pendingFieldIndex];
    if (arg) {
      lines.push(`⌨️ <i>Type a value for <b>${esc(arg.name)}</b> and send it.</i>`);
    }
  } else {
    const requiredCount = state.args.filter((a) => a.required).length;
    const requiredFilled = state.args.filter(
      (a) => a.required && Object.prototype.hasOwnProperty.call(state.collectedArgs, argKey(a)),
    ).length;
    const filledCount = Object.keys(state.collectedArgs).length;

    const progress = requiredCount > 0
      ? `${requiredFilled}/${requiredCount} required`
      : `${filledCount}/${state.args.length}`;
    lines.push(`<i>Tap a field to fill it  ·  ${progress}</i>`);
  }

  return lines.join('\n');
}

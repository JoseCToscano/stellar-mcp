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

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Renders the data portion of a read-only result.
// Priority: simulationResult (actual contract return value), then data.
function formatResultData(result: CallResult): string {
  const value = result.simulationResult ?? result.data;

  if (value === null || value === undefined) return '<i>No data returned.</i>';

  if (Array.isArray(value)) {
    const count = value.length;
    const preview = JSON.stringify(value.slice(0, 3), null, 2);
    const suffix = count > 3 ? `\n  ... (${count - 3} more)` : '';
    return `<code>${esc(preview + suffix)}</code>`;
  }

  const json = JSON.stringify(value, null, 2);
  const truncated = json.length > 800 ? json.slice(0, 800) + '...' : json;
  return `<code>${esc(truncated)}</code>`;
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

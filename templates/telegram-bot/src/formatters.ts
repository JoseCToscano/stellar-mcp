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

  const lines = tools.map((t) => {
    const hasArgs = Object.keys(
      (t.inputSchema.properties ?? {}) as Record<string, unknown>,
    ).length > 0;
    const icon = hasArgs ? '📝' : '👁';
    return `${icon} <b>${esc(t.name)}</b>\n     <i>${esc(t.description || 'No description')}</i>`;
  });

  return truncateMessage([
    `📋 <b>${tools.length} tool${tools.length === 1 ? '' : 's'} available</b>`,
    LINE,
    '',
    ...lines,
    '',
    `<i>👁 = read-only  ·  📝 = requires input</i>`,
    '<i>Use /call to browse and execute</i>',
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

// Renders the form card — the single persistent message showing all parameters
// and their current values. Edited in place as the user fills fields.
// Nested object parameters are shown under group headers.
export function formatForm(state: FormState): string {
  const lines: string[] = [
    `🔧 <b>${esc(state.toolName)}</b>`,
  ];

  if (state.toolDescription) {
    lines.push(`<i>${esc(state.toolDescription)}</i>`);
  }

  lines.push(LINE);
  lines.push('');

  const filledCount = Object.keys(state.collectedArgs).length;
  const requiredCount = state.args.filter((a) => a.required).length;
  const requiredFilled = state.args.filter(
    (a) => a.required && Object.prototype.hasOwnProperty.call(state.collectedArgs, argKey(a)),
  ).length;

  let currentGroup: string | undefined;

  state.args.forEach((arg) => {
    // Insert group header when entering a new nested object section
    if (arg.group !== currentGroup) {
      currentGroup = arg.group;
      if (currentGroup) {
        lines.push(`┄ <b>${esc(currentGroup)}</b> ┄┄┄┄┄┄┄┄┄┄┄┄┄┄`);
      }
    }

    const key = argKey(arg);
    const isSet = Object.prototype.hasOwnProperty.call(state.collectedArgs, key);
    const icon = isSet ? '✅' : arg.required ? '⬜' : '○';
    const req = arg.required && !isSet ? ' *' : '';
    const indent = arg.group ? '  ' : '';

    if (isSet) {
      const val = state.collectedArgs[key];
      const str = val === null ? 'null' : typeof val === 'string' ? val : JSON.stringify(val);
      const display = str.length > 32 ? str.slice(0, 30) + '…' : str;
      lines.push(`${indent}${icon} <b>${esc(arg.name)}</b>${req}  <code>${esc(display)}</code>`);
    } else {
      const typeHint = arg.type !== 'any' && arg.type !== 'enum'
        ? `<i>${esc(arg.type)}</i>`
        : arg.type === 'enum' && arg.enum
          ? `<i>[${arg.enum.slice(0, 3).join('|')}${arg.enum.length > 3 ? '|…' : ''}]</i>`
          : '';
      lines.push(`${indent}${icon} <b>${esc(arg.name)}</b>${req}  ${typeHint}`);
    }
  });

  lines.push('');

  if (state.pendingFieldIndex !== null) {
    const arg = state.args[state.pendingFieldIndex];
    if (arg) {
      lines.push(`⌨️ <i>Type a value for <b>${esc(arg.name)}</b> and send it.</i>`);
    }
  } else {
    const progress = requiredCount > 0
      ? `${requiredFilled}/${requiredCount} required`
      : `${filledCount}/${state.args.length}`;
    lines.push(`<i>${progress}  ·  tap a field to set it</i>`);
  }

  return lines.join('\n');
}

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

// ─── HTML escaping ────────────────────────────────────────────────────────────

export function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ─── /start ───────────────────────────────────────────────────────────────────

export function formatWelcome(serverUrl: string, aiEnabled: boolean): string {
  const aiNote = aiEnabled
    ? '\n\nAI mode is <b>on</b> — just type naturally to interact with the contract.'
    : '\n\nTip: Set <code>AI_ENABLED=true</code> + an API key for natural language chat.';

  return [
    '<b>Stellar MCP Bot</b>',
    '',
    'Connected to:',
    `<code>${esc(serverUrl)}</code>`,
    '',
    '<b>Commands:</b>',
    '/tools — list all available contract tools',
    '/call — browse tools interactively',
    '/call &lt;tool&gt; [json-args] — call a tool directly',
    aiNote,
  ].join('\n');
}

// ─── /tools ───────────────────────────────────────────────────────────────────

export function formatToolsList(tools: ToolInfo[]): string {
  if (tools.length === 0) {
    return 'No tools found on the connected MCP server.';
  }

  const lines = tools.map(
    (t) => `<b>${esc(t.name)}</b> — ${esc(t.description || 'No description')}`,
  );

  return [
    `<b>${tools.length} tool${tools.length === 1 ? '' : 's'} available:</b>`,
    '',
    ...lines,
    '',
    'Use /call to interact with them.',
  ].join('\n');
}

// ─── Tool detail (inline keyboard callback response) ─────────────────────────

export function formatToolDetail(tool: ToolInfo): string {
  const argLines = buildArgPreview(tool.inputSchema);
  const hasArgs = argLines.length > 0;

  const exampleArgs = hasArgs ? ` ${buildExampleJson(tool.inputSchema)}` : '';
  const exampleCall = `/call ${tool.name}${exampleArgs}`;

  return [
    `<b>${esc(tool.name)}</b>`,
    esc(tool.description || 'No description available.'),
    '',
    hasArgs ? '<b>Arguments:</b>' : '<i>No arguments required.</i>',
    ...argLines,
    '',
    'Call it with:',
    `<code>${esc(exampleCall)}</code>`,
  ].join('\n');
}

// ─── /call result ─────────────────────────────────────────────────────────────

export function formatCallResult(
  toolName: string,
  result: CallResult,
  submitResult?: SubmitResult,
): string {
  const networkPassphrase = process.env.NETWORK_PASSPHRASE ?? '';
  const isMainnet = networkPassphrase.includes('Public Global');
  const explorerBase = isMainnet
    ? 'https://stellar.expert/explorer/public'
    : 'https://stellar.expert/explorer/testnet';

  if (submitResult) {
    // Write operation that was signed and submitted
    const ok = submitResult.status === 'SUCCESS';
    const lines = [
      ok ? '✅ Transaction submitted!' : '❌ Transaction failed.',
      '',
      `Hash: <code>${esc(submitResult.hash)}</code>`,
      `Status: <b>${esc(submitResult.status)}</b>`,
    ];
    if (submitResult.hash) {
      lines.push(`<a href="${explorerBase}/tx/${submitResult.hash}">View on Stellar Expert</a>`);
    }
    return lines.join('\n');
  }

  if (result.xdr) {
    // Write operation but no SIGNER_SECRET — return the unsigned XDR
    return [
      `<b>${esc(toolName)}</b> — transaction built (unsigned)`,
      '',
      'XDR:',
      `<code>${esc(result.xdr.slice(0, 100))}...</code>`,
      '',
      '<i>Set SIGNER_SECRET in .env to auto-sign write transactions.</i>',
    ].join('\n');
  }

  // Read-only result
  return [
    `<b>${esc(toolName)}</b>`,
    '',
    formatResultData(result),
  ].join('\n');
}

export function formatError(toolName: string, err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  return `❌ Error calling <b>${esc(toolName)}</b>:\n<code>${esc(msg)}</code>`;
}

export function formatConnectionError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  return `❌ Could not reach MCP server:\n<code>${esc(msg)}</code>`;
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
export function formatForm(state: FormState): string {
  const lines: string[] = [`🔧 <b>${esc(state.toolName)}</b>`];

  if (state.toolDescription) {
    lines.push(`<i>${esc(state.toolDescription)}</i>`);
  }

  lines.push('');

  state.args.forEach((arg) => {
    const isSet = Object.prototype.hasOwnProperty.call(state.collectedArgs, arg.name);
    const icon = isSet ? '✅' : '⬜';
    const req = arg.required ? ' <i>*</i>' : '';

    if (isSet) {
      const val = state.collectedArgs[arg.name];
      const str = typeof val === 'string' ? val : JSON.stringify(val);
      const display = str.length > 42 ? str.slice(0, 40) + '…' : str;
      lines.push(`${icon} <b>${esc(arg.name)}</b>${req}: <code>${esc(display)}</code>`);
    } else {
      lines.push(`${icon} <b>${esc(arg.name)}</b>${req}: —`);
    }
  });

  lines.push('');

  if (state.pendingFieldIndex !== null) {
    const arg = state.args[state.pendingFieldIndex];
    if (arg) {
      lines.push(`<i>⌨️  Type a value for <b>${esc(arg.name)}</b> and send it.</i>`);
    }
  } else {
    lines.push('<i>* required  ·  tap a field button below to set it</i>');
  }

  return lines.join('\n');
}

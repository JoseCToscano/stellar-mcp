// src/commands/call.ts
//
// Implements: stellar-mcp-cli call [tool] [--args json] [--json] [--key val…]
//
// Three input modes:
//   A) --args <json>     → parse JSON, call directly
//   B) --key value …     → parse unknown flags, coerce via parseArgValue
//   C) (no args given)   → mini-wizard via @clack/prompts for each param
//
// All modes share the same executeAndDisplay() path.

import * as p from '@clack/prompts';
import chalk from 'chalk';
import {
  isReadOperation,
  extractArgs,
  buildToolArgs,
  parseArgValue,
  argKey,
  secretKeySigner,
  MCPConnectionError,
  MCPToolError,
  type ToolInfo,
} from '@stellar-mcp/client';
import { createClient, canSign } from '../mcp.js';
import { config } from '../config.js';
import {
  INTERNAL_TOOLS,
  SPINNER_CONNECTING,
  SPINNER_CALLING,
  SPINNER_SIGNING,
} from '../constants.js';
import { mkSpinner, printResult, printSuccess, printWritePreview, printError } from '../ui.js';

interface CallOpts {
  args?: string;
  json?: true;
}

export async function handleCall(toolArg: string | undefined, opts: CallOpts): Promise<void> {
  const jsonMode = Boolean(opts.json);

  // Mode A: tool + --args JSON → direct call, no listTools needed
  if (toolArg && opts.args) {
    let parsedArgs: Record<string, unknown>;
    try {
      parsedArgs = JSON.parse(opts.args) as Record<string, unknown>;
    } catch {
      printError(`Invalid JSON in --args: ${opts.args}`);
    }
    await executeAndDisplay(toolArg, parsedArgs!, jsonMode);
    return;
  }

  // Modes B and C need tool metadata; no-tool also needs tool list
  const client = createClient();
  try {
    const spin = jsonMode ? null : mkSpinner(SPINNER_CONNECTING);
    const allTools = await client.listTools();
    spin?.stop();

    const tools = allTools.filter((t) => !INTERNAL_TOOLS.has(t.name));

    // Resolve tool name (from arg or interactive picker)
    let toolName: string;
    if (toolArg) {
      toolName = toolArg;
    } else {
      const selected = await p.select({
        message: 'Select a tool',
        options: tools.map((t) => ({
          value: t.name,
          label: isReadOperation(t.name) ? chalk.blue(t.name) : chalk.yellow(t.name),
          hint: t.description || undefined,
        })),
      });
      if (p.isCancel(selected)) {
        p.cancel('Cancelled.');
        return;
      }
      toolName = String(selected);
    }

    const tool = tools.find((t) => t.name === toolName);
    if (!tool) {
      printError(`Tool not found: ${chalk.cyan(toolName)}`);
    }

    // Resolve args (flags or wizard)
    const unknownFlags = parseUnknownFlags();
    let callArgs: Record<string, unknown>;

    if (Object.keys(unknownFlags).length > 0) {
      // Mode B: --key value flags
      callArgs = buildArgsFromFlags(tool!, unknownFlags);
    } else {
      // Mode C: mini-wizard
      const argDefs = extractArgs(tool!);
      if (argDefs.length === 0) {
        callArgs = {};
      } else {
        const collected = await collectArgs(tool!);
        if (collected === null) {
          p.cancel('Cancelled.');
          return;
        }
        callArgs = buildToolArgs(argDefs, collected);
      }
    }

    await executeAndDisplay(toolName, callArgs, jsonMode);
  } finally {
    client.close();
  }
}

// ─── Shared execute path ──────────────────────────────────────────────────────

export async function executeAndDisplay(
  toolName: string,
  args: Record<string, unknown>,
  jsonMode: boolean,
): Promise<void> {
  const client = createClient();
  const spin = jsonMode ? null : mkSpinner(SPINNER_CALLING(toolName));

  try {
    const result = await client.call(toolName, args);
    spin?.stop();

    // Read operation or no XDR returned → display data
    if (isReadOperation(toolName) || !result.xdr) {
      if (jsonMode) {
        process.stdout.write(JSON.stringify(result.data, null, 2) + '\n');
      } else {
        printResult(toolName, result.data);
      }
      return;
    }

    // Write operation with XDR
    if (!canSign()) {
      printWritePreview(result.xdr);
      return;
    }

    const signSpin = jsonMode ? null : mkSpinner(SPINNER_SIGNING);
    const submitted = await client.signAndSubmit(result.xdr, {
      signer: secretKeySigner(config.signerSecret!),
    });
    signSpin?.stop();

    if (jsonMode) {
      process.stdout.write(JSON.stringify(submitted, null, 2) + '\n');
    } else {
      printSuccess(submitted.hash);
    }
  } catch (err) {
    spin?.stop();
    if (err instanceof MCPConnectionError) {
      printError(`Connection failed: ${err.message}`);
    } else if (err instanceof MCPToolError) {
      printError(`Tool error: ${err.message}`);
    } else {
      printError(err instanceof Error ? err.message : String(err));
    }
  } finally {
    client.close();
  }
}

// ─── Arg collection wizard (for a single tool) ────────────────────────────────

/** Collect args for a tool interactively. Returns null if cancelled. */
async function collectArgs(
  tool: ToolInfo,
): Promise<Record<string, unknown> | null> {
  const argDefs = extractArgs(tool);
  const collected: Record<string, unknown> = {};
  let cancelled = false;

  await p.group(
    Object.fromEntries(
      argDefs.map((arg) => {
        const key = argKey(arg);
        const label = arg.required
          ? arg.name
          : `${arg.name} ${chalk.dim('(optional)')}`;

        if (arg.type === 'boolean') {
          return [
            key,
            () =>
              p.confirm({
                message: label,
                initialValue: false,
              }),
          ];
        }

        if (arg.enum && arg.enum.length > 0) {
          return [
            key,
            () =>
              p.select({
                message: label,
                options: arg.enum!.map((v) => ({ value: v, label: v })),
              }),
          ];
        }

        return [
          key,
          async () => {
            const placeholder = arg.description || arg.type;
            const raw = await p.text({
              message: label,
              placeholder,
              validate(val) {
                if (arg.required && !val && !arg.nullable) {
                  return `${arg.name} is required`;
                }
              },
            });
            if (p.isCancel(raw)) return raw;
            return parseArgValue(String(raw ?? ''), arg);
          },
        ];
      }),
    ),
    {
      onCancel() {
        cancelled = true;
        p.cancel('Cancelled.');
      },
    },
  ).then((result) => {
    if (!cancelled) {
      Object.assign(collected, result);
    }
  });

  return cancelled ? null : collected;
}

// ─── Unknown flags parser (Mode B) ───────────────────────────────────────────

/**
 * Parse extra --key value flags from process.argv, skipping known Commander
 * options. Called after Commander has already processed its own options.
 */
function parseUnknownFlags(): Record<string, string> {
  const KNOWN = new Set(['--json', '--args', '-i', '--interactive', '--read-only', '--write-only']);
  const result: Record<string, string> = {};
  const argv = process.argv;

  // Skip: node, script, "call", optional tool name
  let i = 3;
  if (i < argv.length && !argv[i].startsWith('-')) i++; // skip tool name

  while (i < argv.length) {
    const arg = argv[i];

    if (KNOWN.has(arg)) {
      // Skip --args and its value
      i += arg === '--args' ? 2 : 1;
      continue;
    }

    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('-')) {
        result[key] = next;
        i += 2;
      } else {
        result[key] = 'true';
        i++;
      }
      continue;
    }

    i++;
  }

  return result;
}

/** Build a nested args object from flat `--key value` flags. */
function buildArgsFromFlags(
  tool: ToolInfo,
  flags: Record<string, string>,
): Record<string, unknown> {
  const argDefs = extractArgs(tool);
  const collected: Record<string, unknown> = {};

  for (const [k, v] of Object.entries(flags)) {
    const def = argDefs.find((a) => a.name === k || argKey(a) === k);
    if (def) {
      collected[argKey(def)] = parseArgValue(v, def);
    } else {
      // Unknown flag: pass through as-is
      collected[k] = v;
    }
  }

  return buildToolArgs(argDefs, collected);
}

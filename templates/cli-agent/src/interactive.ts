// src/interactive.ts
//
// Wizard and interactive REPL loop using @clack/prompts.
//
// runWizard()       — one full operation: tool picker → args → confirm → execute
// runInteractive()  — wraps runWizard() in a loop, asking "Run another?" after each op

import * as p from '@clack/prompts';
import chalk from 'chalk';
import {
  isReadOperation,
  extractArgs,
  buildToolArgs,
  parseArgValue,
  argKey,
  type ToolInfo,
} from '@stellar-mcp/client';
import { createClient } from './mcp.js';
import { INTERNAL_TOOLS, SPINNER_CONNECTING } from './constants.js';
import { mkSpinner } from './ui.js';
import { executeAndDisplay } from './commands/call.js';

// ─── Tool fetcher ─────────────────────────────────────────────────────────────

async function fetchTools(): Promise<ToolInfo[]> {
  const client = createClient();
  try {
    return await client.listTools();
  } finally {
    client.close();
  }
}

// ─── Arg collection ───────────────────────────────────────────────────────────

/**
 * Collect arguments for a tool interactively using p.group().
 * Returns the flat key→value map, or null if the user cancelled.
 */
async function collectArgs(tool: ToolInfo): Promise<Record<string, unknown> | null> {
  const argDefs = extractArgs(tool);
  if (argDefs.length === 0) return {};

  let cancelled = false;
  const collected: Record<string, unknown> = {};

  await p
    .group(
      Object.fromEntries(
        argDefs.map((arg) => {
          const key = argKey(arg);
          const label = arg.required
            ? arg.name
            : `${arg.name} ${chalk.dim('(optional)')}`;

          if (arg.type === 'boolean') {
            return [key, () => p.confirm({ message: label, initialValue: false })];
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
              const raw = await p.text({
                message: label,
                placeholder: arg.description || arg.type,
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
    )
    .then((result) => {
      if (!cancelled) Object.assign(collected, result);
    });

  return cancelled ? null : collected;
}

// ─── Wizard ───────────────────────────────────────────────────────────────────

/**
 * Run one full wizard interaction:
 *   1. Connect + fetch tools
 *   2. Tool picker
 *   3. Arg collection
 *   4. Confirm
 *   5. Execute + display result
 */
export async function runWizard(): Promise<void> {
  p.intro(chalk.bold('◆ Stellar MCP'));

  const spin = mkSpinner(SPINNER_CONNECTING);
  let allTools: ToolInfo[];
  try {
    allTools = await fetchTools();
  } catch (err) {
    spin.stop();
    p.cancel(`Connection failed: ${err instanceof Error ? err.message : String(err)}`);
    return;
  }
  spin.stop();

  const tools = allTools.filter((t) => !INTERNAL_TOOLS.has(t.name));

  if (tools.length === 0) {
    p.outro(chalk.yellow('No tools available on this server.'));
    return;
  }

  const toolName = await p.select({
    message: 'Select a tool',
    options: tools.map((t) => ({
      value: t.name,
      label: isReadOperation(t.name) ? chalk.blue(t.name) : chalk.yellow(t.name),
      hint: t.description || undefined,
    })),
  });

  if (p.isCancel(toolName)) {
    p.cancel('Cancelled.');
    return;
  }

  const tool = tools.find((t) => t.name === toolName)!;

  const collected = await collectArgs(tool);
  if (collected === null) return;

  const callArgs = buildToolArgs(extractArgs(tool), collected);

  const confirmed = await p.confirm({
    message: `Execute ${chalk.cyan(String(toolName))}?`,
  });
  if (!confirmed || p.isCancel(confirmed)) {
    p.cancel('Cancelled.');
    return;
  }

  await executeAndDisplay(String(toolName), callArgs, false);

  p.outro(chalk.green('✔ Done'));
}

// ─── Interactive REPL ─────────────────────────────────────────────────────────

/**
 * Run runWizard() in a loop.
 * After each operation, asks "Run another tool?" — exits on No or Ctrl+C.
 */
export async function runInteractive(): Promise<void> {
  p.intro(chalk.bold('◆ Stellar MCP') + chalk.dim('  (Ctrl+C to exit)'));

  while (true) {
    await runWizard();

    const again = await p.confirm({ message: 'Run another tool?' });
    if (!again || p.isCancel(again)) break;
  }

  p.outro('Goodbye!');
}

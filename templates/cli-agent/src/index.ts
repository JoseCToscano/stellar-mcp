#!/usr/bin/env node
// src/index.ts
//
// Commander entry point for the Stellar MCP CLI.
//
// Usage:
//   stellar-mcp-cli                       → guided wizard (tool picker → args → execute)
//   stellar-mcp-cli --interactive         → REPL loop that keeps running after each op
//   stellar-mcp-cli list [--json] [--read-only] [--write-only]
//   stellar-mcp-cli call [tool] [--args json] [--json] [--key val…]

import { Command } from '@commander-js/extra-typings';
import { handleList } from './commands/list.js';
import { handleCall } from './commands/call.js';
import { runWizard, runInteractive } from './interactive.js';

const program = new Command()
  .name('stellar-mcp-cli')
  .description('Terminal agent for Stellar MCP servers')
  .version('0.1.0')
  .option('-i, --interactive', 'Stay in interactive mode after each operation');

program
  .command('list')
  .description('List available tools on the MCP server')
  .option('--json', 'Output as JSON array')
  .option('--read-only', 'Show only read tools')
  .option('--write-only', 'Show only write tools')
  .action(handleList);

program
  .command('call [tool]')
  .description('Call a tool (omit tool name to pick interactively)')
  .option('--args <json>', 'Arguments as a JSON object string')
  .option('--json', 'Output result as JSON')
  .allowUnknownOption() // enables --key value inline one-shot mode
  .action(handleCall);

// No subcommand → wizard or interactive loop
program.action(async () => {
  const opts = program.opts();
  if (opts.interactive) {
    await runInteractive();
  } else {
    await runWizard();
  }
});

await program.parseAsync();

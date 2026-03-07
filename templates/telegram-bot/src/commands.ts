// src/commands.ts
//
// Dynamic command registration. Fetches the tool list from the MCP server and
// registers each tool as a Telegram bot command so users see autocomplete
// suggestions when they type "/".
//
// MCP tool names use kebab-case (e.g. "deploy-token").
// Telegram command names must be lowercase letters, digits, and underscores
// (no hyphens). We convert: "deploy-token" → "deploy_token".

import type { Bot } from 'grammy';
import type { ToolInfo } from '@stellar-mcp/client';

// ─── Name conversion ──────────────────────────────────────────────────────────

// "deploy-token" → "deploy_token"
export function toolToCommand(toolName: string): string {
  return toolName.replace(/-/g, '_').toLowerCase();
}

// "deploy_token" → "deploy-token"
export function commandToTool(command: string): string {
  return command.replace(/_/g, '-');
}

// ─── Register commands with Telegram ─────────────────────────────────────────

// Calls Telegram's setMyCommands API with all tool commands plus static ones.
// Call this once at startup (dev) or in scripts/setup.ts (production).
export async function registerBotCommands(
  bot: Bot,
  tools: ToolInfo[],
): Promise<void> {
  // Static commands always present
  const staticCommands = [
    { command: 'start', description: 'Welcome and list available commands' },
    { command: 'tools', description: 'List all available contract tools' },
    { command: 'call', description: 'Browse and call tools interactively' },
    { command: 'cancel', description: 'Cancel the current operation' },
  ];

  // One command per MCP tool — Telegram shows these as autocomplete suggestions
  // Description is capped at 256 chars (Telegram limit)
  const toolCommands = tools.map((tool) => ({
    command: toolToCommand(tool.name),
    description: tool.description.slice(0, 256) || tool.name,
  }));

  const allCommands = [...staticCommands, ...toolCommands];

  await bot.api.setMyCommands(allCommands);
  console.log(
    `[commands] Registered ${toolCommands.length} tool commands + ${staticCommands.length} static commands`,
  );
}

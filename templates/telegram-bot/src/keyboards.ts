// src/keyboards.ts
//
// Builds grammy InlineKeyboard instances.
//
// Form card keyboards (the new UX pattern):
//   buildFormKeyboard      — main form: one button per arg + Execute/Cancel
//   buildBooleanSubKeyboard — replaces keyboard inline for boolean fields
//   buildEnumSubKeyboard    — replaces keyboard inline for enum fields
//
// Tool picker keyboard (/call command):
//   buildToolsKeyboard     — grid of all tool names

import { InlineKeyboard } from 'grammy';
import type { ToolInfo } from '@stellar-mcp/client';
import type { FormState } from './conversation.js';

// ─── Tool picker (for /call command) ─────────────────────────────────────────

const MAX_CALLBACK_TOOL_NAME = 59; // 64-byte limit minus "tool:" prefix

export function buildToolsKeyboard(tools: ToolInfo[]): InlineKeyboard {
  const kb = new InlineKeyboard();
  let col = 0;

  tools.forEach((tool, i) => {
    if (tool.name.length > MAX_CALLBACK_TOOL_NAME) return;
    const label = tool.name.length > 22 ? tool.name.slice(0, 20) + '…' : tool.name;
    kb.text(label, `tool:${tool.name}`);
    col++;

    const isLast = i === tools.length - 1;
    if (col === 2 && !isLast) {
      kb.row();
      col = 0;
    }
  });

  return kb;
}

// ─── Form card keyboard ───────────────────────────────────────────────────────
//
// Shows one button per argument. Button label reflects fill status:
//   ✅ fieldName    — value has been set
//   ⬜ fieldName *  — required, not yet set
//   ○  fieldName    — optional, not yet set
//
// Two arg buttons per row. Execute + Cancel on the final row.
//
// Callback data:
//   form:set:<fieldIndex>  — user wants to set this field
//   form:exec              — execute the tool
//   form:cancel            — cancel the form

export function buildFormKeyboard(state: FormState): InlineKeyboard {
  const kb = new InlineKeyboard();

  state.args.forEach((arg, index) => {
    const isSet = Object.prototype.hasOwnProperty.call(state.collectedArgs, arg.name);
    const icon = isSet ? '✅' : arg.required ? '⬜' : '○';
    const suffix = arg.required && !isSet ? ' *' : '';
    // Truncate long names so two fit on a row
    const name = arg.name.length > 16 ? arg.name.slice(0, 14) + '…' : arg.name;
    kb.text(`${icon} ${name}${suffix}`, `form:set:${index}`);

    if (index % 2 === 1) kb.row();
  });

  // Ensure we start the action row on a fresh line
  if (state.args.length % 2 !== 0) kb.row();

  kb.text('▶ Execute', 'form:exec').text('✗ Cancel', 'form:cancel');
  return kb;
}

// ─── Boolean sub-keyboard ─────────────────────────────────────────────────────
//
// Replaces the form keyboard inline when the user taps a boolean field.
// Callback data: form:bool:<fieldIndex>:1 (true) or form:bool:<fieldIndex>:0 (false)

export function buildBooleanSubKeyboard(fieldIndex: number): InlineKeyboard {
  return new InlineKeyboard()
    .text('✅ True', `form:bool:${fieldIndex}:1`)
    .text('❌ False', `form:bool:${fieldIndex}:0`)
    .row()
    .text('← Back', 'form:view');
}

// ─── Enum sub-keyboard ────────────────────────────────────────────────────────
//
// Replaces the form keyboard inline when the user taps an enum field.
// Callback data: form:enum:<fieldIndex>:<enumValueIndex>

export function buildEnumSubKeyboard(fieldIndex: number, values: string[]): InlineKeyboard {
  const kb = new InlineKeyboard();
  const PER_ROW = values.length <= 2 ? 2 : 3;

  values.forEach((val, i) => {
    const label = val.length > 18 ? val.slice(0, 16) + '…' : val;
    kb.text(label, `form:enum:${fieldIndex}:${i}`);
    if ((i + 1) % PER_ROW === 0 && i < values.length - 1) kb.row();
  });

  kb.row().text('← Back', 'form:view');
  return kb;
}

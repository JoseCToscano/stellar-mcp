// src/commands/list.ts
//
// Implements: stellar-mcp-cli list [--json] [--read-only] [--write-only]
//
// Fetches the tool list from the MCP server and displays it as a
// formatted table (default) or raw JSON (--json).
import { isReadOperation } from '@stellar-mcp/client';
import { createClient } from '../mcp.js';
import { INTERNAL_TOOLS, SPINNER_CONNECTING } from '../constants.js';
import { mkSpinner, printToolsTable, printError } from '../ui.js';
export async function handleList(opts) {
    const client = createClient();
    const jsonMode = Boolean(opts.json);
    // Disable spinner in JSON mode — pure stdout only
    const spin = jsonMode ? null : mkSpinner(SPINNER_CONNECTING);
    try {
        const allTools = await client.listTools();
        spin?.stop();
        // Filter out internal plumbing tools
        const tools = allTools.filter((t) => !INTERNAL_TOOLS.has(t.name));
        const readTools = tools.filter((t) => isReadOperation(t.name));
        const writeTools = tools.filter((t) => !isReadOperation(t.name));
        // Apply --read-only / --write-only filters
        const visible = opts.readOnly
            ? readTools
            : opts.writeOnly
                ? writeTools
                : tools;
        if (jsonMode) {
            process.stdout.write(JSON.stringify(visible, null, 2) + '\n');
            return;
        }
        const filteredRead = opts.writeOnly ? [] : readTools;
        const filteredWrite = opts.readOnly ? [] : writeTools;
        printToolsTable(filteredRead, filteredWrite);
    }
    catch (err) {
        spin?.stop();
        printError(err instanceof Error ? err.message : String(err));
    }
    finally {
        client.close();
    }
}

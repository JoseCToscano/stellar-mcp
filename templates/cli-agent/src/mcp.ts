// src/mcp.ts
//
// MCPClient factory for stateless (per-command) usage.
//
// A new MCPClient is created per command invocation rather than shared at
// module level. Always call client.close() in a finally block to release
// the HTTP connection.
//
// Usage:
//   const client = createClient();
//   try {
//     const tools = await client.listTools();
//   } finally {
//     client.close();
//   }

import { MCPClient } from '@stellar-mcp/client';
import { config } from './config.js';

export function createClient(): MCPClient {
  return new MCPClient({
    url: config.mcpUrl,
    networkPassphrase: config.networkPassphrase,
    rpcUrl: config.rpcUrl,
  });
}

// Returns true when SIGNER_SECRET is configured.
// Used to gate write-operation signing paths — the CLI works without a signer
// but will display the XDR preview instead of submitting transactions.
export function canSign(): boolean {
  return Boolean(config.signerSecret);
}

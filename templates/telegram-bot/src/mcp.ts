// src/mcp.ts
//
// MCPClient factory for stateless (serverless) usage.
//
// A new MCPClient is created per-request rather than shared at module level.
// In Vercel serverless functions, invocations don't share memory across cold
// starts, so a module-level singleton would reconnect on every cold start anyway.
// Making the factory explicit documents the pattern clearly for readers.
//
// Usage:
//   const client = createClient();
//   try {
//     const tools = await client.listTools();
//   } finally {
//     client.close(); // always close to release the HTTP connection
//   }

import { MCPClient } from '@stellar-mcp/client';

export function createClient(): MCPClient {
  const url = process.env.MCP_SERVER_URL;
  const networkPassphrase = process.env.NETWORK_PASSPHRASE;
  const rpcUrl = process.env.RPC_URL;

  if (!url) throw new Error('MCP_SERVER_URL is not set');
  if (!networkPassphrase) throw new Error('NETWORK_PASSPHRASE is not set');
  if (!rpcUrl) throw new Error('RPC_URL is not set');

  return new MCPClient({ url, networkPassphrase, rpcUrl });
}

// Returns true when SIGNER_SECRET is configured.
// Used to gate write-operation signing paths — the bot works without a signer
// but will return unsigned XDR instead of submitting transactions.
export function canSign(): boolean {
  return Boolean(process.env.SIGNER_SECRET);
}

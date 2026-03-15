// src/lib/mcp.ts
//
// MCPClient factory.
// Creates a fresh client per call — matches the stateless HTTP server pattern
// used by generated MCP servers (each request = fresh session).

import { MCPClient } from '@stellar-mcp/client';

export function createClient(): MCPClient {
  const raw = process.env.NEXT_PUBLIC_MCP_SERVER_URL;
  if (!raw) {
    throw new Error(
      'NEXT_PUBLIC_MCP_SERVER_URL is not set. Copy .env.example to .env.local and configure it.'
    );
  }

  // Resolve relative paths (e.g. "/mcp") against the current origin so
  // the MCPClient gets a full URL. This lets us proxy through Next.js rewrites
  // to avoid CORS issues when the MCP server is on a different port.
  const url = raw.startsWith('/') ? `${window.location.origin}${raw}` : raw;

  return new MCPClient({
    url,
    networkPassphrase: process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE || 'Test SDF Network ; September 2015',
    rpcUrl: process.env.NEXT_PUBLIC_RPC_URL || 'https://soroban-testnet.stellar.org',
  });
}

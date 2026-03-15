// src/lib/mcp.ts
//
// MCPClient factory.
// Creates a fresh client per call — matches the stateless HTTP server pattern
// used by generated MCP servers (each request = fresh session).

import { MCPClient } from '@stellar-mcp/client';

export function createClient(): MCPClient {
  const url = process.env.NEXT_PUBLIC_MCP_SERVER_URL;
  if (!url) {
    throw new Error(
      'NEXT_PUBLIC_MCP_SERVER_URL is not set. Copy .env.example to .env.local and configure it.'
    );
  }

  return new MCPClient({
    url,
    networkPassphrase: process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE || 'Test SDF Network ; September 2015',
    rpcUrl: process.env.NEXT_PUBLIC_RPC_URL || 'https://soroban-testnet.stellar.org',
  });
}

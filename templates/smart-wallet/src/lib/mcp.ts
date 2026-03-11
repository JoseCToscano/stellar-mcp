// src/lib/mcp.ts
//
// MCPClient factory.
// Creates a fresh client per call — matches the stateless HTTP server pattern
// used by generated MCP servers (each request = fresh session).

import { MCPClient } from '@stellar-mcp/client';

export function createClient(): MCPClient {
  return new MCPClient({
    url: process.env.NEXT_PUBLIC_MCP_SERVER_URL!,
    networkPassphrase: process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE!,
    rpcUrl: process.env.NEXT_PUBLIC_RPC_URL!,
  });
}

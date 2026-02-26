import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { MCPConnectionError } from './errors.js';

/**
 * Create a StreamableHTTP MCP transport (modern stateless HTTP).
 *
 * Note: transport constructors are synchronous and never throw — connection
 * failures only surface when `client.connect(transport)` is called.
 * Transport fallback logic lives in `client.ts` `connect()`.
 *
 * @param url - Full MCP server URL (e.g. http://localhost:3000/mcp)
 */
export async function createTransport(url: string): Promise<Transport> {
  const mcpUrl = parseUrl(url);
  return new StreamableHTTPClientTransport(mcpUrl);
}

/**
 * Create a legacy SSE MCP transport.
 * Used as a fallback when StreamableHTTP connection fails.
 *
 * @param url - Full MCP server URL
 */
export function createSSETransport(url: string): Transport {
  const mcpUrl = parseUrl(url);
  return new SSEClientTransport(mcpUrl);
}

/**
 * Parse and validate a URL string.
 * Throws MCPConnectionError if the URL is malformed.
 */
function parseUrl(url: string): URL {
  try {
    return new URL(url);
  } catch {
    throw new MCPConnectionError(
      `Invalid MCP server URL: "${url}". Provide a full URL like http://localhost:3000/mcp`,
    );
  }
}

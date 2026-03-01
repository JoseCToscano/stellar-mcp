import { describe, it, expect, vi } from 'vitest';
import { MCPConnectionError } from '../../src/errors.js';

const mockStreamableInstance = { type: 'streamable' };
const mockSSEInstance = { type: 'sse' };

vi.mock('@modelcontextprotocol/sdk/client/streamableHttp.js', () => ({
  StreamableHTTPClientTransport: vi.fn().mockImplementation(() => mockStreamableInstance),
}));

vi.mock('@modelcontextprotocol/sdk/client/sse.js', () => ({
  SSEClientTransport: vi.fn().mockImplementation(() => mockSSEInstance),
}));

// Import after mocking
const { createTransport, createSSETransport } = await import('../../src/transport.js');

describe('createTransport', () => {
  it('returns a StreamableHTTP transport for a valid URL', async () => {
    const transport = await createTransport('http://localhost:3000/mcp');
    expect(transport).toBe(mockStreamableInstance);
  });

  it('throws MCPConnectionError for an invalid URL', async () => {
    await expect(createTransport('not-a-url')).rejects.toThrow(MCPConnectionError);
  });

  it('throws MCPConnectionError with descriptive message for invalid URL', async () => {
    await expect(createTransport('not-a-url')).rejects.toThrow('Invalid MCP server URL');
  });
});

describe('createSSETransport', () => {
  it('returns an SSE transport for a valid URL', () => {
    const transport = createSSETransport('http://localhost:3000/mcp');
    expect(transport).toBe(mockSSEInstance);
  });

  it('throws MCPConnectionError for an invalid URL', () => {
    expect(() => createSSETransport('not-a-url')).toThrow(MCPConnectionError);
  });

  it('throws MCPConnectionError with descriptive message for invalid URL', () => {
    expect(() => createSSETransport('not-a-url')).toThrow('Invalid MCP server URL');
  });
});

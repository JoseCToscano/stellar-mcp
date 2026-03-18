import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.mock is hoisted — variables it references must be hoisted too.
const mockMCPClient = vi.hoisted(() => vi.fn());

vi.mock('../../src/config.js', () => ({
  config: {
    mcpUrl: 'http://localhost:3000/mcp',
    rpcUrl: 'https://soroban-testnet.stellar.org',
    networkPassphrase: 'Test SDF Network ; September 2015',
    signerSecret: undefined,
  },
}));

vi.mock('@stellar-mcp/client', () => ({
  MCPClient: mockMCPClient,
}));

import { createClient, canSign } from '../../src/mcp.js';
import { config } from '../../src/config.js';

describe('mcp factory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Regular function (not arrow) so `new mockMCPClient(...)` works as a constructor.
    mockMCPClient.mockImplementation(function (this: object) {
      Object.assign(this, { close: vi.fn() });
    });
  });

  describe('createClient()', () => {
    it('constructs MCPClient with the correct config options', () => {
      createClient();

      expect(mockMCPClient).toHaveBeenCalledOnce();
      expect(mockMCPClient).toHaveBeenCalledWith({
        url: config.mcpUrl,
        networkPassphrase: config.networkPassphrase,
        rpcUrl: config.rpcUrl,
      });
    });

    it('returns the constructed MCPClient instance', () => {
      const client = createClient();
      // Instance created by the constructor — must have the close method we attached.
      expect(typeof client.close).toBe('function');
    });
  });

  describe('canSign()', () => {
    it('returns false when signerSecret is undefined', () => {
      expect(canSign()).toBe(false);
    });
  });
});

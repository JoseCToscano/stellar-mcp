import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('config', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset modules so config.ts is re-evaluated with fresh env
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.resetModules();
  });

  it('loads config from environment variables', async () => {
    process.env.MCP_SERVER_URL = 'http://example.com/mcp';
    process.env.RPC_URL = 'https://my-rpc.example.com';
    process.env.NETWORK_PASSPHRASE = 'My Network ; 2024';
    process.env.SIGNER_SECRET = 'SABCDEF';

    const { config } = await import('../../src/config.js');

    expect(config.mcpUrl).toBe('http://example.com/mcp');
    expect(config.rpcUrl).toBe('https://my-rpc.example.com');
    expect(config.networkPassphrase).toBe('My Network ; 2024');
    expect(config.signerSecret).toBe('SABCDEF');
  });

  it('applies defaults for RPC_URL and NETWORK_PASSPHRASE when not set', async () => {
    process.env.MCP_SERVER_URL = 'http://example.com/mcp';
    delete process.env.RPC_URL;
    delete process.env.NETWORK_PASSPHRASE;
    delete process.env.SIGNER_SECRET;

    const { config } = await import('../../src/config.js');

    expect(config.rpcUrl).toBe('https://soroban-testnet.stellar.org');
    expect(config.networkPassphrase).toBe('Test SDF Network ; September 2015');
    expect(config.signerSecret).toBeUndefined();
  });

  it('throws when MCP_SERVER_URL is missing', async () => {
    delete process.env.MCP_SERVER_URL;

    await expect(import('../../src/config.js')).rejects.toThrow(
      'Missing required env var: MCP_SERVER_URL',
    );
  });

  it('error message includes copy .env hint', async () => {
    delete process.env.MCP_SERVER_URL;

    await expect(import('../../src/config.js')).rejects.toThrow('.env');
  });

  it('treats empty string SIGNER_SECRET as undefined', async () => {
    process.env.MCP_SERVER_URL = 'http://example.com/mcp';
    process.env.SIGNER_SECRET = '';

    const { config } = await import('../../src/config.js');

    expect(config.signerSecret).toBeUndefined();
  });
});

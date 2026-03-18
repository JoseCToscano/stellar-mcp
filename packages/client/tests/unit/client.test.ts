import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MCPClient } from '../../src/client.js';
import { MCPConnectionError, MCPToolError } from '../../src/errors.js';
import type { Signer } from '../../src/types.js';

// Mock the MCP SDK Client
const mockCallTool = vi.fn();
const mockListTools = vi.fn();
const mockConnect = vi.fn();
const mockClose = vi.fn().mockResolvedValue(undefined);

vi.mock('@modelcontextprotocol/sdk/client/index.js', () => ({
  Client: vi.fn().mockImplementation(() => ({
    callTool: mockCallTool,
    listTools: mockListTools,
    connect: mockConnect,
    close: mockClose,
  })),
}));

// Mock the transport module
vi.mock('../../src/transport.js', () => ({
  createTransport: vi.fn().mockResolvedValue({ fake: 'transport' }),
  createSSETransport: vi.fn().mockReturnValue({ fake: 'sse-transport' }),
}));

// Mock the transaction module
const mockExtractFeeFromXdr = vi.fn();
vi.mock('../../src/transaction.js', () => ({
  pollTransaction: vi.fn(),
  extractFeeFromXdr: (...args: unknown[]) => mockExtractFeeFromXdr(...args),
}));

const VALID_OPTIONS = {
  url: 'http://localhost:3000/mcp',
  networkPassphrase: 'Test SDF Network ; September 2015',
  rpcUrl: 'https://soroban-testnet.stellar.org',
};

describe('MCPClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConnect.mockResolvedValue(undefined);
  });

  describe('constructor', () => {
    it('accepts valid options', () => {
      const client = new MCPClient(VALID_OPTIONS);
      expect(client).toBeInstanceOf(MCPClient);
    });

    it('throws if url is missing', () => {
      expect(() => new MCPClient({ ...VALID_OPTIONS, url: '' })).toThrow(MCPConnectionError);
    });

    it('throws if networkPassphrase is missing', () => {
      expect(() => new MCPClient({ ...VALID_OPTIONS, networkPassphrase: '' })).toThrow(
        MCPConnectionError,
      );
    });

    it('throws if rpcUrl is missing', () => {
      expect(() => new MCPClient({ ...VALID_OPTIONS, rpcUrl: '' })).toThrow(MCPConnectionError);
    });
  });

  describe('listTools', () => {
    it('returns mapped tool info', async () => {
      mockListTools.mockResolvedValue({
        tools: [
          {
            name: 'deploy-token',
            description: 'Deploy a new token',
            inputSchema: { type: 'object', properties: { admin: { type: 'string' } } },
          },
          {
            name: 'get-admin',
            description: 'Get the admin address',
            inputSchema: { type: 'object' },
          },
        ],
      });

      const client = new MCPClient(VALID_OPTIONS);
      const tools = await client.listTools();

      expect(tools).toHaveLength(2);
      expect(tools[0]).toEqual({
        name: 'deploy-token',
        description: 'Deploy a new token',
        inputSchema: { type: 'object', properties: { admin: { type: 'string' } } },
      });
    });

    it('passes through outputSchema when server provides it', async () => {
      const outputSchema = {
        type: 'object',
        properties: {
          xdr: { type: 'string' },
          simulationResult: { type: 'string' },
        },
        required: ['xdr'],
      };
      mockListTools.mockResolvedValue({
        tools: [
          {
            name: 'get-admin',
            description: 'Get the admin address',
            inputSchema: { type: 'object' },
            outputSchema,
          },
        ],
      });

      const client = new MCPClient(VALID_OPTIONS);
      const tools = await client.listTools();

      expect(tools[0].outputSchema).toEqual(outputSchema);
    });

    it('connects lazily on first call', async () => {
      mockListTools.mockResolvedValue({ tools: [] });

      const client = new MCPClient(VALID_OPTIONS);
      await client.listTools();

      expect(mockConnect).toHaveBeenCalledTimes(1);
    });

    it('reuses connection on subsequent calls', async () => {
      mockListTools.mockResolvedValue({ tools: [] });

      const client = new MCPClient(VALID_OPTIONS);
      await client.listTools();
      await client.listTools();

      expect(mockConnect).toHaveBeenCalledTimes(1);
    });
  });

  describe('call', () => {
    it('parses tool response with xdr and simulationResult', async () => {
      mockCallTool.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              xdr: 'AAAA...',
              simulationResult: { cost: '100' },
            }),
          },
        ],
      });

      const client = new MCPClient(VALID_OPTIONS);
      const result = await client.call('deploy-token', { admin: 'GABC' });

      expect(result.xdr).toBe('AAAA...');
      expect(result.simulationResult).toEqual({ cost: '100' });
      expect(result.data).toEqual({
        xdr: 'AAAA...',
        simulationResult: { cost: '100' },
      });
    });

    it('parses read-only tool response without xdr', async () => {
      mockCallTool.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: JSON.stringify({ balance: '1000000' }),
          },
        ],
      });

      const client = new MCPClient(VALID_OPTIONS);
      const result = await client.call('get-balance', { address: 'GABC' });

      expect(result.xdr).toBeUndefined();
      expect(result.data).toEqual({ balance: '1000000' });
    });

    it('throws MCPToolError when isError is true', async () => {
      mockCallTool.mockResolvedValue({
        content: [{ type: 'text', text: 'Something went wrong' }],
        isError: true,
      });

      const client = new MCPClient(VALID_OPTIONS);
      await expect(client.call('bad-tool', {})).rejects.toThrow(MCPToolError);
    });

    it('throws MCPToolError when response contains error field', async () => {
      mockCallTool.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: JSON.stringify({ error: 'Tool execution failed', message: 'Oops' }),
          },
        ],
      });

      const client = new MCPClient(VALID_OPTIONS);
      await expect(client.call('failing-tool', {})).rejects.toThrow(MCPToolError);
    });

    it('uses structuredContent when present instead of content[0].text', async () => {
      const structuredContent = { xdr: 'BBBB...', simulationResult: 'GADMIN123' };
      mockCallTool.mockResolvedValue({
        content: [{ type: 'text', text: '{"stale":"text"}' }],
        structuredContent,
      });

      const client = new MCPClient(VALID_OPTIONS);
      const result = await client.call('get-admin');

      // structuredContent takes precedence over content[0].text
      expect(result.data).toEqual(structuredContent);
      expect(result.xdr).toBe('BBBB...');
      expect(result.simulationResult).toBe('GADMIN123');
    });

    it('falls back to content[0].text when no structuredContent', async () => {
      mockCallTool.mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify({ xdr: 'CCCC...', simulationResult: 'GADMIN456' }) }],
        // no structuredContent field
      });

      const client = new MCPClient(VALID_OPTIONS);
      const result = await client.call('get-admin');

      expect(result.data).toEqual({ xdr: 'CCCC...', simulationResult: 'GADMIN456' });
      expect(result.xdr).toBe('CCCC...');
    });

    it('passes arguments to callTool', async () => {
      mockCallTool.mockResolvedValue({
        content: [{ type: 'text', text: '{}' }],
      });

      const client = new MCPClient(VALID_OPTIONS);
      await client.call('transfer', { from: 'GABC', to: 'GDEF', amount: '100' });

      expect(mockCallTool).toHaveBeenCalledWith(
        { name: 'transfer', arguments: { from: 'GABC', to: 'GDEF', amount: '100' } },
        undefined,
        { timeout: 30000 },
      );
    });
  });

  describe('signAndSubmit', () => {
    it('delegates to signer with correct context', async () => {
      const mockSigner: Signer = {
        execute: vi.fn().mockResolvedValue({
          hash: 'abc123',
          status: 'SUCCESS',
        }),
      };

      const client = new MCPClient(VALID_OPTIONS);
      const result = await client.signAndSubmit('XDR_HERE', {
        signer: mockSigner,
      });

      expect(result.hash).toBe('abc123');
      expect(result.status).toBe('SUCCESS');

      // Verify signer received correct context
      const call = (mockSigner.execute as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(call[0]).toBe('XDR_HERE');
      expect(call[1].rpcUrl).toBe(VALID_OPTIONS.rpcUrl);
      expect(call[1].networkPassphrase).toBe(VALID_OPTIONS.networkPassphrase);
      expect(typeof call[1].mcpCall).toBe('function');
    });
  });

  describe('simulate', () => {
    it('returns xdr and fee for write operations', async () => {
      mockCallTool.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: JSON.stringify({ xdr: 'AAAA...', simulationResult: undefined }),
          },
        ],
      });
      mockExtractFeeFromXdr.mockReturnValue('12345');

      const client = new MCPClient(VALID_OPTIONS);
      const result = await client.simulate('deploy-token', { deployer: 'GABC' });

      expect(result.xdr).toBe('AAAA...');
      expect(result.fee).toBe('12345');
      expect(mockExtractFeeFromXdr).toHaveBeenCalledWith('AAAA...', VALID_OPTIONS.networkPassphrase);
    });

    it('returns simulationResult for read-only operations without xdr', async () => {
      mockCallTool.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: JSON.stringify({ simulationResult: 'GADMIN123' }),
          },
        ],
      });

      const client = new MCPClient(VALID_OPTIONS);
      const result = await client.simulate('get-admin');

      expect(result.xdr).toBeUndefined();
      expect(result.fee).toBeUndefined();
      expect(result.simulationResult).toBe('GADMIN123');
      expect(mockExtractFeeFromXdr).not.toHaveBeenCalled();
    });

    it('returns undefined fee when XDR parsing fails', async () => {
      mockCallTool.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: JSON.stringify({ xdr: 'BAD_XDR', simulationResult: null }),
          },
        ],
      });
      mockExtractFeeFromXdr.mockReturnValue(undefined);

      const client = new MCPClient(VALID_OPTIONS);
      const result = await client.simulate('deploy-token', {});

      expect(result.xdr).toBe('BAD_XDR');
      expect(result.fee).toBeUndefined();
    });

    it('propagates MCPToolError from underlying call', async () => {
      mockCallTool.mockResolvedValue({
        content: [{ type: 'text', text: 'Tool error' }],
        isError: true,
      });

      const client = new MCPClient(VALID_OPTIONS);
      await expect(client.simulate('bad-tool', {})).rejects.toThrow(MCPToolError);
    });
  });

  describe('close', () => {
    it('can be called safely without connecting', () => {
      const client = new MCPClient(VALID_OPTIONS);
      expect(() => client.close()).not.toThrow();
    });

    it('closes the MCP client after connecting', async () => {
      mockListTools.mockResolvedValue({ tools: [] });

      const client = new MCPClient(VALID_OPTIONS);
      await client.listTools();
      client.close();

      expect(mockClose).toHaveBeenCalled();
    });
  });
});

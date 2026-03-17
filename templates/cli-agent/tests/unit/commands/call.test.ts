import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock client ──────────────────────────────────────────────────────────────

const mockCall = vi.fn();
const mockSignAndSubmit = vi.fn();
const mockClose = vi.fn();

vi.mock('../../../src/mcp.js', () => ({
  createClient: vi.fn(() => ({
    call: mockCall,
    signAndSubmit: mockSignAndSubmit,
    listTools: vi.fn(),
    close: mockClose,
  })),
  canSign: vi.fn(() => false),
}));

// ─── Mock config ──────────────────────────────────────────────────────────────

vi.mock('../../../src/config.js', () => ({
  config: {
    mcpUrl: 'http://localhost:3000/mcp',
    rpcUrl: 'https://soroban-testnet.stellar.org',
    networkPassphrase: 'Test SDF Network ; September 2015',
    signerSecret: undefined,
  },
}));

// ─── Mock SDK helpers ─────────────────────────────────────────────────────────

vi.mock('@stellar-mcp/client', () => ({
  isReadOperation: vi.fn((name: string) => name.startsWith('get-') || name.startsWith('list-')),
  extractArgs: vi.fn(() => []),
  buildToolArgs: vi.fn(() => ({})),
  parseArgValue: vi.fn((v: string) => v),
  argKey: vi.fn((arg: { path: string[] }) => arg.path.join('.')),
  secretKeySigner: vi.fn(() => ({ execute: vi.fn() })),
  MCPConnectionError: class MCPConnectionError extends Error {},
  MCPToolError: class MCPToolError extends Error {},
}));

// ─── Mock UI ──────────────────────────────────────────────────────────────────

vi.mock('../../../src/ui.js', () => ({
  mkSpinner: vi.fn(() => ({ stop: vi.fn() })),
  printResult: vi.fn(),
  printSuccess: vi.fn(),
  printWritePreview: vi.fn(),
  printError: vi.fn(() => { throw new Error('printError called'); }),
}));

import { executeAndDisplay } from '../../../src/commands/call.js';
import { canSign } from '../../../src/mcp.js';
import { printResult, printSuccess, printWritePreview, printError } from '../../../src/ui.js';
import { isReadOperation } from '@stellar-mcp/client';

describe('executeAndDisplay', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockClose.mockResolvedValue(undefined);
    // Default: read operation, no XDR
    (isReadOperation as ReturnType<typeof vi.fn>).mockImplementation(
      (name: string) => name.startsWith('get-') || name.startsWith('list-'),
    );
  });

  // ─── Read operations ─────────────────────────────────────────────────────

  it('calls printResult for read operations', async () => {
    mockCall.mockResolvedValue({ data: { admin: 'GABC...' }, xdr: undefined });

    await executeAndDisplay('get-admin', {}, false);

    expect(printResult).toHaveBeenCalledWith('get-admin', { admin: 'GABC...' });
  });

  it('writes JSON to stdout for read ops in --json mode', async () => {
    mockCall.mockResolvedValue({ data: { admin: 'GABC...' }, xdr: undefined });
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    await executeAndDisplay('get-admin', {}, true);

    expect(printResult).not.toHaveBeenCalled();
    const written = writeSpy.mock.calls[0][0] as string;
    expect(JSON.parse(written)).toEqual({ admin: 'GABC...' });
    writeSpy.mockRestore();
  });

  it('always closes the client', async () => {
    mockCall.mockResolvedValue({ data: 'ok', xdr: undefined });

    await executeAndDisplay('get-admin', {}, false);

    expect(mockClose).toHaveBeenCalledOnce();
  });

  // ─── Write operations without signer ─────────────────────────────────────

  it('shows XDR preview when canSign is false and XDR is returned', async () => {
    (canSign as ReturnType<typeof vi.fn>).mockReturnValue(false);
    (isReadOperation as ReturnType<typeof vi.fn>).mockReturnValue(false);
    mockCall.mockResolvedValue({ data: { xdr: 'AAAA==' }, xdr: 'AAAA==' });

    await executeAndDisplay('deploy-token', { deployer: 'GABC' }, false);

    expect(printWritePreview).toHaveBeenCalledWith('AAAA==');
    expect(mockSignAndSubmit).not.toHaveBeenCalled();
  });

  // ─── Write operations with signer ────────────────────────────────────────

  it('signs and submits when canSign is true', async () => {
    (canSign as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (isReadOperation as ReturnType<typeof vi.fn>).mockReturnValue(false);
    mockCall.mockResolvedValue({ data: {}, xdr: 'BBBB==' });
    mockSignAndSubmit.mockResolvedValue({ hash: 'txhash123', status: 'SUCCESS' });

    await executeAndDisplay('transfer', { to: 'GABC', amount: 100 }, false);

    expect(mockSignAndSubmit).toHaveBeenCalledOnce();
    expect(printSuccess).toHaveBeenCalledWith('txhash123');
  });

  it('writes JSON submit result in --json mode', async () => {
    (canSign as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (isReadOperation as ReturnType<typeof vi.fn>).mockReturnValue(false);
    mockCall.mockResolvedValue({ data: {}, xdr: 'CCCC==' });
    mockSignAndSubmit.mockResolvedValue({ hash: 'abc', status: 'SUCCESS' });
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    await executeAndDisplay('transfer', {}, true);

    const written = writeSpy.mock.calls[0][0] as string;
    expect(JSON.parse(written)).toMatchObject({ hash: 'abc', status: 'SUCCESS' });
    writeSpy.mockRestore();
  });

  // ─── Write op treated as read (no XDR) ───────────────────────────────────

  it('shows data (not XDR preview) when write op returns no XDR', async () => {
    (canSign as ReturnType<typeof vi.fn>).mockReturnValue(false);
    (isReadOperation as ReturnType<typeof vi.fn>).mockReturnValue(false);
    mockCall.mockResolvedValue({ data: { count: 5 }, xdr: undefined });

    await executeAndDisplay('get-token-count', {}, false);

    expect(printResult).toHaveBeenCalledWith('get-token-count', { count: 5 });
    expect(printWritePreview).not.toHaveBeenCalled();
  });

  // ─── Passes args to client.call ───────────────────────────────────────────

  it('forwards args to client.call', async () => {
    mockCall.mockResolvedValue({ data: {}, xdr: undefined });

    const args = { deployer: 'GABC...', amount: 100 };
    await executeAndDisplay('get-balance', args, false);

    expect(mockCall).toHaveBeenCalledWith('get-balance', args);
  });

  // ─── Error handling ───────────────────────────────────────────────────────

  it('calls printError on MCPConnectionError', async () => {
    const { MCPConnectionError } = await import('@stellar-mcp/client');
    mockCall.mockRejectedValue(new MCPConnectionError('refused'));

    await expect(executeAndDisplay('get-admin', {}, false)).rejects.toThrow('printError called');
    expect(printError).toHaveBeenCalledWith('Connection failed: refused');
  });

  it('calls printError on MCPToolError', async () => {
    const { MCPToolError } = await import('@stellar-mcp/client');
    mockCall.mockRejectedValue(new MCPToolError('bad args'));

    await expect(executeAndDisplay('get-admin', {}, false)).rejects.toThrow('printError called');
    expect(printError).toHaveBeenCalledWith('Tool error: bad args');
  });

  it('calls printError on generic Error', async () => {
    mockCall.mockRejectedValue(new Error('unexpected'));

    await expect(executeAndDisplay('get-admin', {}, false)).rejects.toThrow('printError called');
    expect(printError).toHaveBeenCalledWith('unexpected');
  });

  it('closes client even when an error is thrown', async () => {
    mockCall.mockRejectedValue(new Error('boom'));

    await expect(executeAndDisplay('get-admin', {}, false)).rejects.toThrow();
    expect(mockClose).toHaveBeenCalledOnce();
  });
});

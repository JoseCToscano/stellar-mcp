import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Shared mock client state ─────────────────────────────────────────────────

const mockListTools = vi.fn();
const mockClose = vi.fn();

vi.mock('../../../src/mcp.js', () => ({
  createClient: vi.fn(() => ({
    listTools: mockListTools,
    close: mockClose,
  })),
}));

// ─── Silence UI output ────────────────────────────────────────────────────────

vi.mock('../../../src/ui.js', () => ({
  mkSpinner: vi.fn(() => ({ stop: vi.fn() })),
  printToolsTable: vi.fn(),
  printError: vi.fn(() => { throw new Error('printError called'); }),
}));

// ─── Prevent dotenv from overriding test env ──────────────────────────────────

vi.mock('../../../src/config.js', () => ({
  config: {
    mcpUrl: 'http://localhost:3000/mcp',
    rpcUrl: 'https://soroban-testnet.stellar.org',
    networkPassphrase: 'Test SDF Network ; September 2015',
    signerSecret: undefined,
  },
}));

import { handleList } from '../../../src/commands/list.js';
import { printToolsTable, printError } from '../../../src/ui.js';

// Sample tool list returned by the mock MCP server
const SAMPLE_TOOLS = [
  { name: 'get-admin', description: 'Get admin address', inputSchema: {} },
  { name: 'get-token-count', description: 'Get token count', inputSchema: {} },
  { name: 'deploy-token', description: 'Deploy a token', inputSchema: {} },
  { name: 'transfer', description: 'Transfer tokens', inputSchema: {} },
  // Internal tools — must be filtered
  { name: 'sign-and-submit', description: 'Internal', inputSchema: {} },
  { name: 'prepare-transaction', description: 'Internal', inputSchema: {} },
];

describe('handleList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListTools.mockResolvedValue(SAMPLE_TOOLS);
    mockClose.mockResolvedValue(undefined);
  });

  // ─── Pretty table mode ───────────────────────────────────────────────────

  it('calls printToolsTable with read and write tools separated', async () => {
    await handleList({});

    expect(printToolsTable).toHaveBeenCalledOnce();
    const [readArgs, writeArgs] = (printToolsTable as ReturnType<typeof vi.fn>).mock.calls[0] as [
      { name: string }[], { name: string }[]
    ];

    expect(readArgs.map((t) => t.name)).toEqual(['get-admin', 'get-token-count']);
    expect(writeArgs.map((t) => t.name)).toEqual(['deploy-token', 'transfer']);
  });

  it('filters out internal tools', async () => {
    await handleList({});

    const [readArgs, writeArgs] = (printToolsTable as ReturnType<typeof vi.fn>).mock.calls[0] as [
      { name: string }[], { name: string }[]
    ];
    const allNames = [...readArgs, ...writeArgs].map((t) => t.name);

    expect(allNames).not.toContain('sign-and-submit');
    expect(allNames).not.toContain('prepare-transaction');
  });

  it('always closes the client', async () => {
    await handleList({});
    expect(mockClose).toHaveBeenCalledOnce();
  });

  it('closes the client even if listTools throws', async () => {
    mockListTools.mockRejectedValue(new Error('network error'));

    await expect(handleList({})).rejects.toThrow(); // printError re-throws in mock
    expect(mockClose).toHaveBeenCalledOnce();
  });

  // ─── --read-only filter ───────────────────────────────────────────────────

  it('passes empty write list with --read-only', async () => {
    await handleList({ readOnly: true });

    const [, writeArgs] = (printToolsTable as ReturnType<typeof vi.fn>).mock.calls[0] as [
      unknown[], { name: string }[]
    ];
    expect(writeArgs).toHaveLength(0);
  });

  // ─── --write-only filter ──────────────────────────────────────────────────

  it('passes empty read list with --write-only', async () => {
    await handleList({ writeOnly: true });

    const [readArgs] = (printToolsTable as ReturnType<typeof vi.fn>).mock.calls[0] as [
      { name: string }[], unknown[]
    ];
    expect(readArgs).toHaveLength(0);
  });

  // ─── --json mode ──────────────────────────────────────────────────────────

  it('writes JSON to stdout in --json mode', async () => {
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    await handleList({ json: true });

    expect(writeSpy).toHaveBeenCalledOnce();
    const written = writeSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(written) as { name: string }[];

    // Internal tools must be excluded
    expect(parsed.some((t) => t.name === 'sign-and-submit')).toBe(false);
    expect(parsed.some((t) => t.name === 'get-admin')).toBe(true);

    writeSpy.mockRestore();
  });

  it('does not call printToolsTable in --json mode', async () => {
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    await handleList({ json: true });

    expect(printToolsTable).not.toHaveBeenCalled();
  });

  it('respects --read-only with --json', async () => {
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    await handleList({ json: true, readOnly: true });

    const written = writeSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(written) as { name: string }[];

    expect(parsed.every((t) => ['get-admin', 'get-token-count'].includes(t.name))).toBe(true);
    expect(parsed.some((t) => t.name === 'deploy-token')).toBe(false);

    writeSpy.mockRestore();
  });

  it('prints error on connection failure', async () => {
    mockListTools.mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(handleList({})).rejects.toThrow(); // mock printError re-throws
    expect(printError).toHaveBeenCalledWith('ECONNREFUSED');
  });
});

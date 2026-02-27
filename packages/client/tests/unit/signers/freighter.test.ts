import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MCPToolError } from '../../../src/errors.js';
import { TOOL_PREPARE_TRANSACTION } from '../../../src/types.js';
import type { SignerContext } from '../../../src/types.js';

// ─── Mock @creit.tech/stellar-wallets-kit ─────────────────────────────────────
// The wallet kit is a browser peer dep loaded via dynamic import. We mock the
// entire module so these tests run in Node without a browser environment.

const mockSignTransaction = vi.fn();
const mockGetAddress = vi.fn();
const MockStellarWalletsKit = vi.fn().mockImplementation(() => ({
  getAddress:      mockGetAddress,
  signTransaction: mockSignTransaction,
}));

vi.mock('@creit.tech/stellar-wallets-kit', () => ({
  StellarWalletsKit: MockStellarWalletsKit,
  WalletNetwork: { TESTNET: 'TESTNET', PUBLIC: 'PUBLIC' },
  allowAllModules: vi.fn().mockReturnValue([]),
}));

// ─── Mock transaction helpers ─────────────────────────────────────────────────
// Avoid real RPC calls.

const mockSubmit = vi.fn().mockResolvedValue({ hash: 'tx-hash-abc' });
const mockPoll   = vi.fn().mockResolvedValue({ hash: 'tx-hash-abc', status: 'SUCCESS' });

vi.mock('../../../src/transaction.js', () => ({
  submitSignedTransaction: mockSubmit,
  pollTransaction:         mockPoll,
}));

// ─── Import after mocks are set up ────────────────────────────────────────────
const { freighterSigner, connectFreighter } = await import('../../../src/signers/freighter.js');

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TESTNET_PASSPHRASE = 'Test SDF Network ; September 2015';
const MAINNET_PASSPHRASE = 'Public Global Stellar Network ; September 2015';
const WALLET_ADDRESS     = 'GABCDE12345';
const WALLET_READY_XDR   = 'WALLET_READY_XDR_BASE64';
const SIGNED_XDR         = 'SIGNED_XDR_BASE64';

function createMockContext(walletReadyXdr = WALLET_READY_XDR): SignerContext {
  return {
    rpcUrl: 'https://soroban-testnet.stellar.org',
    networkPassphrase: TESTNET_PASSPHRASE,
    mcpCall: vi.fn().mockResolvedValue({ walletReadyXdr }),
  };
}

// ─── freighterSigner ──────────────────────────────────────────────────────────

describe('freighterSigner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAddress.mockResolvedValue({ address: WALLET_ADDRESS });
    mockSignTransaction.mockResolvedValue({ signedTxXdr: SIGNED_XDR });
  });

  it('fetches wallet address and calls prepare-transaction', async () => {
    const ctx    = createMockContext();
    const signer = freighterSigner();
    await signer.execute('UNSIGNED_XDR', ctx);

    expect(mockGetAddress).toHaveBeenCalledOnce();
    expect(ctx.mcpCall).toHaveBeenCalledWith(TOOL_PREPARE_TRANSACTION, {
      xdr:         'UNSIGNED_XDR',
      walletAddress: WALLET_ADDRESS,
      toolName:    'freighter-signer',
    });
  });

  it('signs the wallet-ready XDR and submits to RPC', async () => {
    const ctx    = createMockContext();
    const signer = freighterSigner();
    await signer.execute('UNSIGNED_XDR', ctx);

    expect(mockSignTransaction).toHaveBeenCalledWith(WALLET_READY_XDR, {
      address:           WALLET_ADDRESS,
      networkPassphrase: TESTNET_PASSPHRASE,
    });
    expect(mockSubmit).toHaveBeenCalledWith(SIGNED_XDR, ctx.rpcUrl, TESTNET_PASSPHRASE);
  });

  it('returns the confirmed SubmitResult', async () => {
    const ctx    = createMockContext();
    const signer = freighterSigner();
    const result = await signer.execute('UNSIGNED_XDR', ctx);

    expect(result.hash).toBe('tx-hash-abc');
    expect(result.status).toBe('SUCCESS');
  });

  it('selects PUBLIC network when passphrase contains "Public Global Stellar Network"', async () => {
    const ctx = {
      ...createMockContext(),
      networkPassphrase: MAINNET_PASSPHRASE,
    };
    const signer = freighterSigner();
    await signer.execute('XDR', ctx);

    expect(MockStellarWalletsKit).toHaveBeenCalledWith(
      expect.objectContaining({ network: 'PUBLIC' }),
    );
  });

  it('throws MCPToolError when prepare-transaction returns empty walletReadyXdr', async () => {
    const ctx = createMockContext(''); // empty string → failure
    // Override mcpCall to return the failure shape the server sends
    (ctx.mcpCall as ReturnType<typeof vi.fn>).mockResolvedValue({
      walletReadyXdr: '',
      preview: { error: 'Account not found: GABCDE...' },
    });

    const signer = freighterSigner();
    await expect(signer.execute('XDR', ctx)).rejects.toThrow(MCPToolError);
    await expect(signer.execute('XDR', ctx)).rejects.toThrow('Account not found');
  });

  it('wraps StellarWalletsKit plain-object errors into proper Error instances', async () => {
    mockSignTransaction.mockRejectedValue({ code: 4001, message: 'User rejected the request' });
    const ctx    = createMockContext();
    const signer = freighterSigner();

    await expect(signer.execute('XDR', ctx)).rejects.toThrow('User rejected the request');
    await expect(signer.execute('XDR', ctx)).rejects.toBeInstanceOf(Error);
  });
});

// ─── connectFreighter ─────────────────────────────────────────────────────────

describe('connectFreighter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAddress.mockResolvedValue({ address: WALLET_ADDRESS });
    mockSignTransaction.mockResolvedValue({ signedTxXdr: SIGNED_XDR });
  });

  it('returns the wallet address', async () => {
    const { address } = await connectFreighter(TESTNET_PASSPHRASE);
    expect(address).toBe(WALLET_ADDRESS);
  });

  it('creates the kit only once during connect', async () => {
    await connectFreighter(TESTNET_PASSPHRASE);
    expect(MockStellarWalletsKit).toHaveBeenCalledOnce();
    expect(mockGetAddress).toHaveBeenCalledOnce();
  });

  it('returned signer uses the closed-over address — no second getAddress call', async () => {
    const { signer } = await connectFreighter(TESTNET_PASSPHRASE);
    const ctx        = createMockContext();

    // First transaction
    await signer.execute('XDR_1', ctx);
    // Second transaction
    await signer.execute('XDR_2', ctx);

    // getAddress was called once at connect time, never again for transactions
    expect(mockGetAddress).toHaveBeenCalledOnce();
  });

  it('returned signer signs and submits correctly', async () => {
    const { signer } = await connectFreighter(TESTNET_PASSPHRASE);
    const ctx        = createMockContext();
    const result     = await signer.execute('UNSIGNED_XDR', ctx);

    expect(mockSignTransaction).toHaveBeenCalledWith(WALLET_READY_XDR, {
      address:           WALLET_ADDRESS,
      networkPassphrase: TESTNET_PASSPHRASE,
    });
    expect(mockSubmit).toHaveBeenCalledWith(SIGNED_XDR, ctx.rpcUrl, TESTNET_PASSPHRASE);
    expect(result.hash).toBe('tx-hash-abc');
    expect(result.status).toBe('SUCCESS');
  });

  it('selects TESTNET when passphrase is testnet', async () => {
    await connectFreighter(TESTNET_PASSPHRASE);
    expect(MockStellarWalletsKit).toHaveBeenCalledWith(
      expect.objectContaining({ network: 'TESTNET' }),
    );
  });

  it('selects PUBLIC when passphrase is mainnet', async () => {
    await connectFreighter(MAINNET_PASSPHRASE);
    expect(MockStellarWalletsKit).toHaveBeenCalledWith(
      expect.objectContaining({ network: 'PUBLIC' }),
    );
  });

  it('throws MCPToolError when prepare-transaction returns empty walletReadyXdr', async () => {
    const { signer } = await connectFreighter(TESTNET_PASSPHRASE);
    const ctx = createMockContext();
    (ctx.mcpCall as ReturnType<typeof vi.fn>).mockResolvedValue({
      walletReadyXdr: '',
      preview: { error: 'Account not found: GABCDE...' },
    });

    await expect(signer.execute('XDR', ctx)).rejects.toThrow(MCPToolError);
    await expect(signer.execute('XDR', ctx)).rejects.toThrow('Account not found');
  });

  it('normalises StellarWalletsKit plain-object errors', async () => {
    const { signer } = await connectFreighter(TESTNET_PASSPHRASE);
    mockSignTransaction.mockRejectedValue({ code: 4001, message: 'User rejected the request' });
    const ctx = createMockContext();

    await expect(signer.execute('XDR', ctx)).rejects.toThrow('User rejected the request');
    await expect(signer.execute('XDR', ctx)).rejects.toBeInstanceOf(Error);
  });
});

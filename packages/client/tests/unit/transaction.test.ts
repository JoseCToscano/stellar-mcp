import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TransactionError } from '../../src/errors.js';

// Mock @stellar/stellar-sdk
const mockSendTransaction = vi.fn();
const mockGetTransaction = vi.fn();
const mockFromXDR = vi.fn().mockReturnValue({ fake: 'tx' });

vi.mock('@stellar/stellar-sdk', () => ({
  TransactionBuilder: {
    fromXDR: (...args: unknown[]) => mockFromXDR(...args),
  },
  rpc: {
    Server: vi.fn().mockImplementation(() => ({
      sendTransaction: mockSendTransaction,
      getTransaction: mockGetTransaction,
    })),
  },
}));

// Import after mocking
const { submitSignedTransaction, pollTransaction, extractFeeFromXdr } = await import('../../src/transaction.js');

describe('submitSignedTransaction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns hash on PENDING status', async () => {
    mockSendTransaction.mockResolvedValue({
      status: 'PENDING',
      hash: 'tx_hash_123',
    });

    const result = await submitSignedTransaction(
      'signed_xdr',
      'https://soroban-testnet.stellar.org',
      'Test SDF Network ; September 2015',
    );

    expect(result.hash).toBe('tx_hash_123');
    expect(mockFromXDR).toHaveBeenCalledWith('signed_xdr', 'Test SDF Network ; September 2015');
  });

  it('throws TransactionError on non-PENDING status', async () => {
    mockSendTransaction.mockResolvedValue({
      status: 'ERROR',
      hash: 'tx_hash_fail',
      errorResultXdr: 'AAAA',
    });

    await expect(
      submitSignedTransaction(
        'signed_xdr',
        'https://soroban-testnet.stellar.org',
        'Test SDF Network ; September 2015',
      ),
    ).rejects.toThrow(TransactionError);
  });
});

describe('pollTransaction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns result on SUCCESS status', async () => {
    mockGetTransaction.mockResolvedValue({
      status: 'SUCCESS',
      resultXdr: 'result_xdr',
    });

    const promise = pollTransaction('tx_hash', 'https://soroban-testnet.stellar.org');

    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.hash).toBe('tx_hash');
    expect(result.status).toBe('SUCCESS');
  });

  it('throws TransactionError on FAILED status', async () => {
    mockGetTransaction.mockResolvedValue({
      status: 'FAILED',
    });

    const promise = pollTransaction('tx_hash', 'https://soroban-testnet.stellar.org');

    // Need to catch it here to avoid unhandled rejection
    const errorPromise = promise.catch((e: unknown) => e);
    await vi.runAllTimersAsync();
    const error = await errorPromise;

    expect(error).toBeInstanceOf(TransactionError);
  });

  it('polls until SUCCESS after NOT_FOUND', async () => {
    let callCount = 0;
    mockGetTransaction.mockImplementation(async () => {
      callCount++;
      if (callCount < 3) {
        return { status: 'NOT_FOUND' };
      }
      return { status: 'SUCCESS', resultXdr: 'result' };
    });

    const promise = pollTransaction('tx_hash', 'https://soroban-testnet.stellar.org');

    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.status).toBe('SUCCESS');
    expect(callCount).toBe(3);
  });
});

describe('extractFeeFromXdr', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns fee string when XDR parses successfully', () => {
    mockFromXDR.mockReturnValue({ fee: '12345' });

    const fee = extractFeeFromXdr('AAAA...', 'Test SDF Network ; September 2015');

    expect(fee).toBe('12345');
    expect(mockFromXDR).toHaveBeenCalledWith('AAAA...', 'Test SDF Network ; September 2015');
  });

  it('returns undefined when XDR parsing throws', () => {
    mockFromXDR.mockImplementation(() => {
      throw new Error('bad XDR');
    });

    const fee = extractFeeFromXdr('not-valid-xdr', 'Test SDF Network ; September 2015');

    expect(fee).toBeUndefined();
  });

  it('returns undefined when parsed transaction has no fee field', () => {
    mockFromXDR.mockReturnValue({});

    const fee = extractFeeFromXdr('AAAA...', 'Test SDF Network ; September 2015');

    expect(fee).toBeUndefined();
  });
});

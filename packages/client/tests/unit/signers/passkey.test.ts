import { describe, it, expect, vi } from 'vitest';
import { passkeyKitSigner } from '../../../src/signers/passkey.js';
import { MCPToolError } from '../../../src/errors.js';
import { TOOL_SIGN_AND_SUBMIT } from '../../../src/types.js';
import type { SignerContext } from '../../../src/types.js';

function createMockContext(mcpCallResult: unknown = {}): SignerContext {
  return {
    rpcUrl: 'https://soroban-testnet.stellar.org',
    networkPassphrase: 'Test SDF Network ; September 2015',
    mcpCall: vi.fn().mockResolvedValue(mcpCallResult),
  };
}

describe('passkeyKitSigner', () => {
  it('calls sign-and-submit with xdr, walletContractId, and secretKey as fee payer', async () => {
    const ctx = createMockContext({
      success: true,
      result: { hash: 'tx789', status: 'SUCCESS' },
    });

    const signer = passkeyKitSigner({
      walletContractId: 'CABC...',
      feePayerSecret: 'SFEE...',
    });
    await signer.execute('XDR_PAYLOAD', ctx);

    expect(ctx.mcpCall).toHaveBeenCalledWith(TOOL_SIGN_AND_SUBMIT, {
      xdr: 'XDR_PAYLOAD',
      walletContractId: 'CABC...',
      secretKey: 'SFEE...',
    });
  });

  it('returns parsed SubmitResult from server response', async () => {
    const ctx = createMockContext({
      success: true,
      result: { hash: 'tx789', status: 'SUCCESS', parsedResult: { value: 'ok' } },
    });

    const signer = passkeyKitSigner({
      walletContractId: 'CABC...',
      feePayerSecret: 'SFEE...',
    });
    const result = await signer.execute('XDR_PAYLOAD', ctx);

    expect(result.hash).toBe('tx789');
    expect(result.status).toBe('SUCCESS');
    expect(result.result).toEqual({ value: 'ok' });
  });

  it('throws MCPToolError on non-object response', async () => {
    const ctx = createMockContext(null);

    const signer = passkeyKitSigner({
      walletContractId: 'CABC...',
      feePayerSecret: 'SFEE...',
    });
    await expect(signer.execute('XDR_PAYLOAD', ctx)).rejects.toThrow(MCPToolError);
  });
});

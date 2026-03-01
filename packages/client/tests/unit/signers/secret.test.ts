import { describe, it, expect, vi } from 'vitest';
import { secretKeySigner } from '../../../src/signers/secret.js';
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

describe('secretKeySigner', () => {
  it('calls sign-and-submit with xdr and secretKey', async () => {
    const ctx = createMockContext({
      success: true,
      result: { hash: 'tx123', status: 'SUCCESS' },
    });

    const signer = secretKeySigner('SAAAA...');
    await signer.execute('XDR_PAYLOAD', ctx);

    expect(ctx.mcpCall).toHaveBeenCalledWith(TOOL_SIGN_AND_SUBMIT, {
      xdr: 'XDR_PAYLOAD',
      secretKey: 'SAAAA...',
    });
  });

  it('returns parsed SubmitResult from server response', async () => {
    const ctx = createMockContext({
      success: true,
      result: { hash: 'tx123', status: 'SUCCESS', parsedResult: { value: 42 } },
    });

    const signer = secretKeySigner('SAAAA...');
    const result = await signer.execute('XDR_PAYLOAD', ctx);

    expect(result.hash).toBe('tx123');
    expect(result.status).toBe('SUCCESS');
    expect(result.result).toEqual({ value: 42 });
  });

  it('handles flat response format (hash/status at top level)', async () => {
    const ctx = createMockContext({
      hash: 'tx456',
      status: 'SUCCESS',
    });

    const signer = secretKeySigner('SAAAA...');
    const result = await signer.execute('XDR_PAYLOAD', ctx);

    expect(result.hash).toBe('tx456');
    expect(result.status).toBe('SUCCESS');
  });

  it('throws MCPToolError on non-object response', async () => {
    const ctx = createMockContext(null);

    const signer = secretKeySigner('SAAAA...');
    await expect(signer.execute('XDR_PAYLOAD', ctx)).rejects.toThrow(MCPToolError);
  });
});

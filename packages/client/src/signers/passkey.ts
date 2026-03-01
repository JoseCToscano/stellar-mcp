import type { Signer, SubmitResult, SignerContext, PasskeyKitSignerOptions } from '../types.js';
import { TOOL_SIGN_AND_SUBMIT } from '../types.js';
import { logger } from '../logger.js';
import { parseSubmitResponse } from './utils.js';

/**
 * Create a signer for PasskeyKit smart wallet transactions.
 *
 * Delegates to the MCP server's `sign-and-submit` tool with both the
 * `walletContractId` and `secretKey` (fee payer). The server reads
 * `WALLET_SIGNER_SECRET` from its own environment for auth entry signing,
 * and uses the provided `secretKey` as the fee payer.
 *
 * @param options - PasskeyKit signer configuration
 * @returns Signer adapter compatible with MCPClient.signAndSubmit()
 *
 * @example
 * ```ts
 * const result = await client.signAndSubmit(xdr, {
 *   signer: passkeyKitSigner({
 *     walletContractId: 'CABC...',
 *     feePayerSecret: process.env.FEE_PAYER_SECRET!,
 *   }),
 * });
 * ```
 */
export function passkeyKitSigner(options: PasskeyKitSignerOptions): Signer {
  return {
    async execute(xdr: string, context: SignerContext): Promise<SubmitResult> {
      logger.debug('PasskeyKit signer: delegating to MCP sign-and-submit', {
        walletContractId: options.walletContractId,
      });

      const data = await context.mcpCall(TOOL_SIGN_AND_SUBMIT, {
        xdr,
        walletContractId: options.walletContractId,
        secretKey: options.feePayerSecret,
      });

      const result = parseSubmitResponse(data);
      logger.info('PasskeyKit signer: transaction submitted', {
        hash: result.hash,
        status: result.status,
      });
      return result;
    },
  };
}

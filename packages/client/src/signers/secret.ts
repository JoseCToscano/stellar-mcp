import type { Signer, SubmitResult, SignerContext } from '../types.js';
import { TOOL_SIGN_AND_SUBMIT } from '../types.js';
import { logger } from '../logger.js';
import { parseSubmitResponse } from './utils.js';

/**
 * Create a signer that delegates signing and submission to the MCP server.
 *
 * The secret key is passed as a parameter to the server's `sign-and-submit` tool
 * at runtime — the server never stores it. The server handles auth entry signing,
 * envelope signing, fresh sequence numbers, and OpenZeppelin Relayer submission.
 *
 * @param secretKey - Stellar secret key (S...) for signing
 * @returns Signer adapter compatible with MCPClient.signAndSubmit()
 *
 * @example
 * ```ts
 * const result = await client.signAndSubmit(xdr, {
 *   signer: secretKeySigner(process.env.SIGNER_SECRET!),
 * });
 * ```
 */
export function secretKeySigner(secretKey: string): Signer {
  return {
    async execute(xdr: string, context: SignerContext): Promise<SubmitResult> {
      logger.debug('SecretKey signer: delegating to MCP sign-and-submit');

      const data = await context.mcpCall(TOOL_SIGN_AND_SUBMIT, {
        xdr,
        secretKey,
      });

      const result = parseSubmitResponse(data);
      logger.info('SecretKey signer: transaction submitted', {
        hash: result.hash,
        status: result.status,
      });
      return result;
    },
  };
}

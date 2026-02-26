import type { Signer, SubmitResult, SignerContext, FreighterSignerOptions } from '../types.js';
import { TOOL_PREPARE_TRANSACTION } from '../types.js';
import { MCPToolError } from '../errors.js';
import { logger } from '../logger.js';
import { submitSignedTransaction, pollTransaction } from '../transaction.js';

/** Default wallet ID for Freighter browser extension */
const FREIGHTER_WALLET_ID = 'freighter';

/**
 * Create a signer that uses a browser wallet (Freighter) via StellarWalletsKit.
 *
 * Flow:
 * 1. Dynamically import StellarWalletsKit (browser-only dep, loaded on demand)
 * 2. Get wallet address from StellarWalletsKit
 * 3. Call MCP `prepare-transaction` to rebuild XDR with fresh sequence for wallet
 * 4. Sign the wallet-ready XDR with the browser extension
 * 5. Submit the signed transaction directly to Stellar RPC (not through MCP)
 * 6. Poll for confirmation
 *
 * Why direct submit? The MCP server's `sign-and-submit` tool re-signs the XDR.
 * Since Freighter already signed it, we submit directly to avoid double-signing.
 *
 * **Browser-only** — requires `@creit.tech/stellar-wallets-kit` as a peer dependency.
 * The wallet kit is loaded via dynamic import so Node.js consumers of the main
 * package entry are not affected.
 *
 * @param _options - Optional Freighter signer configuration (reserved for future use)
 * @returns Signer adapter compatible with MCPClient.signAndSubmit()
 *
 * @example
 * ```ts
 * const result = await client.signAndSubmit(xdr, {
 *   signer: freighterSigner(),
 * });
 * ```
 */
export function freighterSigner(_options?: FreighterSignerOptions): Signer {
  return {
    async execute(xdr: string, context: SignerContext): Promise<SubmitResult> {
      logger.debug('Freighter signer: starting browser wallet flow');

      // Dynamic import — wallet kit only loaded at invocation time.
      // This keeps it out of the static import graph for Node.js consumers.
      const { StellarWalletsKit, WalletNetwork, allowAllModules } =
        await import('@creit.tech/stellar-wallets-kit');

      // Step 1: Get the connected wallet address
      const network = context.networkPassphrase.includes('Public Global Stellar Network')
        ? WalletNetwork.PUBLIC
        : WalletNetwork.TESTNET;

      const kit = new StellarWalletsKit({
        network,
        selectedWalletId: FREIGHTER_WALLET_ID,
        modules: allowAllModules(),
      });

      const { address: walletAddress } = await kit.getAddress();
      logger.debug('Freighter signer: got wallet address', { walletAddress });

      // Step 2: Call MCP prepare-transaction to get wallet-ready XDR
      logger.debug('Freighter signer: calling prepare-transaction');
      const walletReadyXdr = await prepareForWallet(xdr, walletAddress, context);

      // Step 3: Sign with browser wallet
      logger.debug('Freighter signer: requesting wallet signature');
      let signedTxXdr: string;
      try {
        const signed = await kit.signTransaction(walletReadyXdr, {
          address: walletAddress,
          networkPassphrase: context.networkPassphrase,
        });
        signedTxXdr = signed.signedTxXdr;
      } catch (err) {
        // StellarWalletsKit throws plain objects on rejection/error, not Error instances.
        // Normalise so callers always get a proper Error with a readable message.
        throw new Error(extractWalletKitMessage(err));
      }

      // Step 4: Submit directly to Stellar RPC
      logger.debug('Freighter signer: submitting signed transaction to network');
      const { hash } = await submitSignedTransaction(
        signedTxXdr,
        context.rpcUrl,
        context.networkPassphrase,
      );

      // Step 5: Poll for confirmation
      logger.info('Freighter signer: polling for confirmation', { hash });
      const result = await pollTransaction(hash, context.rpcUrl);
      logger.info('Freighter signer: transaction confirmed', {
        hash: result.hash,
        status: result.status,
      });
      return result;
    },
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Extract a human-readable message from whatever StellarWalletsKit throws.
 * The kit throws plain objects like { code: 4001, message: '...' } rather
 * than Error instances, so we have to handle all shapes.
 */
function extractWalletKitMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'object' && err !== null) {
    const obj = err as Record<string, unknown>;
    if (typeof obj.message === 'string') return obj.message;
    if (typeof obj.error   === 'string') return obj.error;
    if (typeof obj.code    === 'number') return `Wallet error (code ${obj.code})`;
    try { return JSON.stringify(err); } catch { /* ignore */ }
  }
  return String(err);
}

// ─── Internal Helpers ─────────────────────────────────────────────────────────

/**
 * Call MCP prepare-transaction to get wallet-ready XDR.
 * The server rebuilds the tx with the wallet's address as source,
 * fetches a fresh sequence number, and re-simulates.
 */
async function prepareForWallet(
  xdr: string,
  walletAddress: string,
  context: SignerContext,
): Promise<string> {
  const data = await context.mcpCall(TOOL_PREPARE_TRANSACTION, {
    xdr,
    walletAddress,
    toolName: 'freighter-signer',
  });

  if (typeof data !== 'object' || data === null) {
    throw new MCPToolError(TOOL_PREPARE_TRANSACTION, 'Unexpected response format');
  }

  const response = data as Record<string, unknown>;
  const walletReadyXdr = response.walletReadyXdr;

  if (typeof walletReadyXdr !== 'string') {
    throw new MCPToolError(TOOL_PREPARE_TRANSACTION, 'Server did not return walletReadyXdr');
  }

  return walletReadyXdr;
}

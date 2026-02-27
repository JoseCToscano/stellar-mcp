import type { Signer, SubmitResult, SignerContext, FreighterSignerOptions, FreighterConnection } from '../types.js';
import { TOOL_PREPARE_TRANSACTION } from '../types.js';
import { MCPToolError } from '../errors.js';
import { logger } from '../logger.js';
import { submitSignedTransaction, pollTransaction } from '../transaction.js';

/** Default wallet ID for Freighter browser extension */
const FREIGHTER_WALLET_ID = 'freighter';

// ─── connectFreighter ─────────────────────────────────────────────────────────

/**
 * Connect to the Freighter browser wallet and return both the wallet address
 * and a pre-connected signer adapter.
 *
 * **Recommended for browser dApps.** Unlike `freighterSigner()`, this function
 * connects to the wallet once and closes over the connection — the returned signer
 * will NOT re-prompt Freighter for the address on every transaction.
 *
 * Flow:
 * 1. Dynamically import StellarWalletsKit (browser-only dep, loaded on demand)
 * 2. Create kit and fetch the wallet address (one-time)
 * 3. Return `{ address, signer }` — address for your UI, signer for signAndSubmit()
 *
 * The returned signer internally:
 * - Calls MCP `prepare-transaction` to rebuild XDR with wallet as source
 * - Signs the wallet-ready XDR via the already-open Freighter extension
 * - Submits directly to Stellar RPC (not through MCP, to avoid double-signing)
 * - Polls for confirmation
 *
 * **Browser-only** — requires `@creit.tech/stellar-wallets-kit` as a peer dependency.
 *
 * @param networkPassphrase - Stellar network passphrase (used to select TESTNET or PUBLIC)
 * @returns Object with `address` (wallet public key) and `signer` (ready for signAndSubmit)
 *
 * @example
 * ```ts
 * import { connectFreighter } from '@stellar-mcp/client';
 * import { Networks } from '@stellar/stellar-sdk';
 *
 * // Connect once — get address for UI and signer for transactions
 * const { address, signer } = await connectFreighter(Networks.TESTNET);
 *
 * // Display address in your header
 * headerEl.textContent = address;
 *
 * // Later, when user submits a form:
 * const result = await client.signAndSubmit(xdr, { signer });
 * ```
 */
export async function connectFreighter(networkPassphrase: string): Promise<FreighterConnection> {
  logger.debug('connectFreighter: importing wallet kit');

  // Dynamic import — wallet kit only loaded at invocation time.
  const { StellarWalletsKit, WalletNetwork, allowAllModules } =
    await import('@creit.tech/stellar-wallets-kit');

  const network = networkPassphrase.includes('Public Global Stellar Network')
    ? WalletNetwork.PUBLIC
    : WalletNetwork.TESTNET;

  // Create kit once — the returned signer closes over this instance
  const kit = new StellarWalletsKit({
    network,
    selectedWalletId: FREIGHTER_WALLET_ID,
    modules: allowAllModules(),
  });

  const { address } = await kit.getAddress();
  logger.info('connectFreighter: wallet connected', { address });

  // The signer closes over `kit` and `address` — no re-init, no re-prompt
  const signer: Signer = {
    async execute(xdr: string, context: SignerContext): Promise<SubmitResult> {
      logger.debug('Freighter signer: starting pre-connected wallet flow');

      // Step 1: Call MCP prepare-transaction to get wallet-ready XDR
      logger.debug('Freighter signer: calling prepare-transaction');
      const walletReadyXdr = await prepareForWallet(xdr, address, context);

      // Step 2: Sign with the already-open kit (no new getAddress call)
      logger.debug('Freighter signer: requesting wallet signature');
      let signedTxXdr: string;
      try {
        const signed = await kit.signTransaction(walletReadyXdr, {
          address,
          networkPassphrase: context.networkPassphrase,
        });
        signedTxXdr = signed.signedTxXdr;
      } catch (err) {
        // StellarWalletsKit throws plain objects on rejection/error, not Error instances.
        throw new Error(extractWalletKitMessage(err));
      }

      // Step 3: Submit directly to Stellar RPC
      logger.debug('Freighter signer: submitting signed transaction to network');
      const { hash } = await submitSignedTransaction(
        signedTxXdr,
        context.rpcUrl,
        context.networkPassphrase,
      );

      // Step 4: Poll for confirmation
      logger.info('Freighter signer: polling for confirmation', { hash });
      const result = await pollTransaction(hash, context.rpcUrl);
      logger.info('Freighter signer: transaction confirmed', {
        hash: result.hash,
        status: result.status,
      });
      return result;
    },
  };

  return { address, signer };
}

// ─── freighterSigner ──────────────────────────────────────────────────────────

/**
 * Create a signer that uses a browser wallet (Freighter) via StellarWalletsKit.
 *
 * This is the standalone variant — it connects fresh on every `signAndSubmit()` call.
 * For browser dApps that also need to display the wallet address, prefer
 * `connectFreighter()` instead (connects once, returns address + signer together).
 *
 * Flow per transaction:
 * 1. Dynamically import StellarWalletsKit
 * 2. Get wallet address from StellarWalletsKit
 * 3. Call MCP `prepare-transaction` to rebuild XDR with fresh sequence for wallet
 * 4. Sign the wallet-ready XDR with the browser extension
 * 5. Submit the signed transaction directly to Stellar RPC (not through MCP)
 * 6. Poll for confirmation
 *
 * **Browser-only** — requires `@creit.tech/stellar-wallets-kit` as a peer dependency.
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
      const { StellarWalletsKit, WalletNetwork, allowAllModules } =
        await import('@creit.tech/stellar-wallets-kit');

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

      // Call MCP prepare-transaction to get wallet-ready XDR
      logger.debug('Freighter signer: calling prepare-transaction');
      const walletReadyXdr = await prepareForWallet(xdr, walletAddress, context);

      // Sign with browser wallet
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
        throw new Error(extractWalletKitMessage(err));
      }

      // Submit directly to Stellar RPC
      logger.debug('Freighter signer: submitting signed transaction to network');
      const { hash } = await submitSignedTransaction(
        signedTxXdr,
        context.rpcUrl,
        context.networkPassphrase,
      );

      // Poll for confirmation
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

  if (typeof walletReadyXdr !== 'string' || walletReadyXdr === '') {
    // Server returns walletReadyXdr: '' on failure — extract the real reason from preview.error
    const preview = response.preview as Record<string, unknown> | undefined;
    const reason  = typeof preview?.error === 'string' ? preview.error : 'Server did not return walletReadyXdr';
    throw new MCPToolError(TOOL_PREPARE_TRANSACTION, reason);
  }

  return walletReadyXdr;
}

import { TransactionBuilder, rpc } from '@stellar/stellar-sdk';
import { TransactionError } from './errors.js';
import { POLL_INTERVAL_MS, MAX_POLL_ATTEMPTS } from './types.js';
import { logger } from './logger.js';

/** Status returned by Stellar RPC when a transaction is accepted for processing */
const PENDING_STATUS = 'PENDING';

/** Status indicating successful transaction completion */
const SUCCESS_STATUS = 'SUCCESS';

/** Status indicating the transaction has not yet been processed */
const NOT_FOUND_STATUS = 'NOT_FOUND';

/** Milliseconds per second — used for human-readable timeout messages */
const MS_PER_SECOND = 1000;

/**
 * Submit a signed transaction directly to the Stellar network.
 *
 * Used by the Freighter signer flow — after the browser wallet signs the XDR,
 * the SDK submits it directly to Stellar RPC (not through MCP, since the MCP
 * server's sign-and-submit tool would re-sign it).
 *
 * @param signedXdr - Signed transaction XDR (base64)
 * @param rpcUrl - Soroban RPC URL
 * @param networkPassphrase - Stellar network passphrase
 * @returns Object with the transaction hash
 */
export async function submitSignedTransaction(
  signedXdr: string,
  rpcUrl: string,
  networkPassphrase: string,
): Promise<{ hash: string }> {
  const server = new rpc.Server(rpcUrl, { allowHttp: rpcUrl.startsWith('http:') });

  const tx = TransactionBuilder.fromXDR(signedXdr, networkPassphrase);
  logger.debug('Submitting signed transaction to network');
  const response = await server.sendTransaction(tx);

  if (response.status !== PENDING_STATUS) {
    const errorDetail =
      (response as unknown as Record<string, unknown>).errorResultXdr ?? JSON.stringify(response);

    throw new TransactionError(
      `Transaction submission failed with status "${response.status}": ${errorDetail}`,
      response.hash,
    );
  }

  logger.info('Transaction submitted', { hash: response.hash });
  return { hash: response.hash };
}

/**
 * Poll the Stellar network until a transaction is confirmed or fails.
 *
 * Uses POLL_INTERVAL_MS and MAX_POLL_ATTEMPTS from constants.
 * Total maximum wait: POLL_INTERVAL_MS * MAX_POLL_ATTEMPTS (default: 30 seconds).
 *
 * @param hash - Transaction hash to poll
 * @param rpcUrl - Soroban RPC URL
 * @returns Submit result with hash, status, and parsed result
 */
export async function pollTransaction(
  hash: string,
  rpcUrl: string,
): Promise<{ hash: string; status: string; result?: unknown }> {
  const server = new rpc.Server(rpcUrl, { allowHttp: rpcUrl.startsWith('http:') });

  logger.debug('Polling transaction', { hash, maxAttempts: MAX_POLL_ATTEMPTS });

  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    const txResponse = await server.getTransaction(hash);

    if (txResponse.status === SUCCESS_STATUS) {
      return {
        hash,
        status: txResponse.status,
        result: txResponse,
      };
    }

    if (txResponse.status !== NOT_FOUND_STATUS) {
      // Transaction completed but not successfully (e.g. FAILED)
      throw new TransactionError(
        `Transaction ${hash} ended with status "${txResponse.status}"`,
        hash,
      );
    }

    // Still processing — wait and retry
    await sleep(POLL_INTERVAL_MS);
  }

  throw new TransactionError(
    `Transaction ${hash} not confirmed after ${MAX_POLL_ATTEMPTS} attempts (${(POLL_INTERVAL_MS * MAX_POLL_ATTEMPTS) / MS_PER_SECOND}s)`,
    hash,
  );
}

/**
 * Extract the fee from a transaction XDR without submitting it.
 * Returns the fee in stroops as a string, or undefined if the XDR cannot be parsed.
 */
export function extractFeeFromXdr(xdr: string, networkPassphrase: string): string | undefined {
  try {
    const tx = TransactionBuilder.fromXDR(xdr, networkPassphrase);
    return tx.fee;
  } catch {
    return undefined;
  }
}

/** Promise-based sleep utility */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

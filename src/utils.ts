import { ReadResourceCallback } from '@modelcontextprotocol/sdk/server/mcp.js';
import { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';
import { Keypair, Networks } from '@stellar/stellar-sdk';
import path from 'path';
import fs from 'fs/promises';
import { Client as SacClient } from 'sac-sdk';
import { PasskeyKit, PasskeyServer, PasskeyClient } from 'passkey-kit';
import dotenv from 'dotenv';
import { contract } from '@stellar/stellar-sdk/minimal';

dotenv.config();

/**
 * Get a PasskeyKit instance for a given wallet contract ID
 * @param walletContractId - The contract ID of the wallet
 * @returns A PasskeyKit instance for the given wallet contract ID
 */
export const getPasskeyWallet = (walletContractId: string) => {
  const pkKit = new PasskeyKit({
    rpcUrl: process.env.RPC_URL!,
    networkPassphrase: process.env.NETWORK_PASSPHRASE!,
    walletWasmHash: process.env.WALLET_WASM_HASH!,
  });
  pkKit.wallet = new PasskeyClient({
    contractId: walletContractId,
    rpcUrl: process.env.RPC_URL!,
    networkPassphrase: process.env.NETWORK_PASSPHRASE!,
  });
  return pkKit;
};

export const passkeyServer = new PasskeyServer({
  rpcUrl: process.env.RPC_URL,
  launchtubeUrl: process.env.LAUNCHTUBE_URL,
  launchtubeJwt: process.env.LAUNCHTUBE_JWT,
  mercuryProjectName: process.env.MERCURY_PROJECT_NAME,
  mercuryUrl: process.env.MERCURY_URL,
  mercuryJwt: process.env.MERCURY_JWT,
});

/**
 * Check if the transaction needs to be signed with the wallet signer
 * @param transactionXdr - The transaction XDR
 * @param contractId - The contract ID
 * @returns - Whether the transaction needs to be signed with the wallet signer and the wallet contract ID
 */
export const shouldSignWithWalletSigner = async (
  assembledTransaction: contract.AssembledTransaction<unknown>,
  contractId: string
): Promise<{
  shouldSignWithSigner: boolean;
  walletContractId: string;
}> => {
  const sacClient = await createSACClient(
    contractId,
    process.env.NETWORK_PASSPHRASE!,
    process.env.RPC_URL!
  );
  const requiredSigners = assembledTransaction.needsNonInvokerSigningBy({
    includeAlreadySigned: false,
  });

  let walletContractId = '';
  if (requiredSigners.length > 0) {
    // Check if any required signer is a C-address (smart wallet)
    walletContractId =
      requiredSigners.find((address) => address.startsWith('C')) ?? '';
  }

  return {
    shouldSignWithSigner: walletContractId !== '',
    walletContractId: walletContractId,
  };
};

export const readMarkdownResource: ReadResourceCallback = async (
  uri: URL,
  _extra: RequestHandlerExtra
) => {
  const filePath = path.resolve(uri.pathname);
  const content = await fs.readFile(filePath, 'utf-8');

  return {
    contents: [
      {
        uri: uri.toString(),
        text: content,
        mimeType: 'text/markdown', // Or "application/json" depending on the file
      },
    ],
  };
};

export const readTxtResource: ReadResourceCallback = async (
  uri: URL,
  _extra: RequestHandlerExtra
) => {
  const filePath = path.resolve(uri.pathname);
  const content = await fs.readFile(filePath, 'utf-8');
  return {
    contents: [
      {
        uri: uri.toString(),
        text: content,
        mimeType: 'text/plain',
      },
    ],
  };
};

export const submitToLaunchtube = async (xdrTx: string, fee?: number) => {
  if (!process.env.LAUNCHTUBE_URL)
    throw new Error('Launchtube service not configured');

  const data = new FormData();

  data.set('xdr', xdrTx);

  if (fee) data.set('fee', fee.toString());
  const launchtubeHeaders = {
    'X-Client-Name': 'passkey-kit',
    'X-Client-Version': '0.10.19',
    Authorization: `Bearer ${process.env.LAUNCHTUBE_JWT}`,
  };

  return fetch(process.env.LAUNCHTUBE_URL, {
    method: 'POST',
    headers: launchtubeHeaders,
    body: data,
  }).then(async (res) => {
    if (res.ok) return res.json();
    else throw await res.json();
  });
};

export const createContractClient = async (
  contractId: string,
  networkPassphrase: string,
  rpcUrl: string
): Promise<contract.Client> => {
  return contract.Client.from({
    contractId,
    networkPassphrase,
    rpcUrl,
  });
};

export const createSACClient = async (
  contractId: string,
  networkPassphrase: string,
  rpcUrl: string
): Promise<SacClient> => {
  return new SacClient({
    contractId,
    rpcUrl,
    networkPassphrase,
  });
};

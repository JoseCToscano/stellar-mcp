import { ReadResourceCallback } from '@modelcontextprotocol/sdk/server/mcp.js';
import { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';
import { Keypair, Networks } from '@stellar/stellar-sdk';
import path from 'path';
import fs from 'fs/promises';
import { Client as SacClient } from 'sac-sdk';
import { PasskeyKit, PasskeyServer, PasskeyClient } from 'passkey-kit';
import { ChannelsClient } from '@openzeppelin/relayer-plugin-channels';
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
  relayerUrl: process.env.RELAYER_URL,
  relayerApiKey: process.env.RELAYER_API_KEY,
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

let _channelsClient: ChannelsClient | null = null;

function getChannelsClient(): ChannelsClient {
  if (!_channelsClient) {
    const relayerUrl = process.env.RELAYER_URL;
    const relayerApiKey = process.env.RELAYER_API_KEY;
    if (!relayerUrl || !relayerApiKey) {
      throw new Error('RELAYER_URL and RELAYER_API_KEY environment variables are required');
    }
    _channelsClient = new ChannelsClient({ baseUrl: relayerUrl, apiKey: relayerApiKey });
  }
  return _channelsClient;
}

export const submitToRelayer = async (xdrTx: string): Promise<{ hash: string | null; transactionId: string | null; status: string | null }> => {
  return getChannelsClient().submitTransaction({ xdr: xdrTx });
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

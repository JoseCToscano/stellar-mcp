#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import {
  Horizon,
  Keypair,
  rpc,
  authorizeEntry,
  xdr,
  scValToNative,
} from '@stellar/stellar-sdk';
import { basicNodeSigner } from '@stellar/stellar-sdk/contract';
import {
  createSACClient,
  submitToLaunchtube,
  readTxtResource,
  readMarkdownResource,
  passkeyServer,
  shouldSignWithWalletSigner,
  getPasskeyWallet,
} from './utils.js';

// Create server instance
const server = new McpServer({
  name: 'stellar-mcp',
  version: '1.0.0',
  capabilities: { resources: {}, tools: {} },
});

const AGENT_KEYPAIR_FILE_PATH = process.env.AGENT_KEYPAIR_FILE_PATH;
const USAGE_GUIDE_FILE_PATH = process.env.USAGE_GUIDE_FILE_PATH;
const SAC_GUIDE_FILE_PATH = process.env.SAC_GUIDE_FILE_PATH;

if (AGENT_KEYPAIR_FILE_PATH) {
  // Register agent_keys.txt
  server.resource(
    'Agent Keys',
    `file:///${AGENT_KEYPAIR_FILE_PATH}`,
    { description: 'Stellar keypair for the AI Agent', mimeType: 'text/plain' },
    readTxtResource
  );
}

if (USAGE_GUIDE_FILE_PATH) {
  // Register usage.md
  server.resource(
    'MCP Usage Guide',
    `file:///${USAGE_GUIDE_FILE_PATH}`,
    {
      description: 'How and when to use Stellar tools and the provided keys',
      mimeType: 'text/markdown',
    },
    readMarkdownResource
  );
}

// Register SAC guide
server.resource(
  'Stellar Tokens SAC Guide',
  `file:///${SAC_GUIDE_FILE_PATH}`,
  {
    description:
      'Guide for interacting with Stellar Asset Contracts (SAC) through the MCP server',
    mimeType: 'text/markdown',
  },
  readMarkdownResource
);

server.tool('create-account', 'Create a new Stellar account.', {}, async () => {
  try {
    const keypair = Keypair.random();

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            { publicKey: keypair.publicKey(), secretKey: keypair.secret() },
            null,
            2
          ),
        },
      ],
    };
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 404) {
      return { content: [{ type: 'text', text: `Error creating account` }] };
    }
    throw error; // Let MCP handle other errors
  }
});

server.tool(
  'fund-account',
  'Fund a Stellar account with testnet lumens.',
  { address: z.string().describe('The Stellar address to fund') },
  async ({ address }) => {
    try {
      await fetch(`https://friendbot.stellar.org?addr=${address}`)
        .then((res) => res.json())
        .then((json) => {
          return json;
        });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              { message: 'Account funded successfully' },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 404) {
        return {
          content: [{ type: 'text', text: `Account ${address} not found` }],
        };
      }
      throw error; // Let MCP handle other errors
    }
  }
);

// Register weather tools
server.tool(
  'get-account',
  'Fetch a minimal set of current info about a Stellar account.',
  { address: z.string().describe('The Stellar address to fetch info for') },
  async ({ address }) => {
    try {
      const horizonServer = new Horizon.Server(
        'https://horizon-testnet.stellar.org'
      );
      const account = await horizonServer.loadAccount(address);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                id: account.id,
                accountId: account.account_id,
                sequence: account.sequence,
                balances: account.balances,
                signers: account.signers,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 404) {
        return {
          content: [{ type: 'text', text: `Account ${address} not found` }],
        };
      }
      throw error; // Let MCP handle other errors
    }
  }
);

server.tool(
  'get-transactions',
  'Fetch an array of transactions for a given Stellar address.',
  {
    address: z
      .string()
      .describe('The Stellar address to fetch transactions for'),
  },
  async ({ address }) => {
    try {
      const horizonServer = new Horizon.Server(
        'https://horizon-testnet.stellar.org'
      );
      const transactions = await horizonServer
        .transactions()
        .forAccount(address)
        .call();
      return {
        content: [{ type: 'text', text: JSON.stringify(transactions) }],
      };
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 404) {
        return {
          content: [{ type: 'text', text: `Account ${address} not found` }],
        };
      }
      throw error; // Let MCP handle other errors
    }
  }
);

server.tool(
  'sign-and-submit-transaction',
  'Sign and submit a Soroban transaction to the Stellar network.',
  {
    transactionXdr: z
      .string()
      .describe('The transaction XDR to sign and submit'),
    contractId: z
      .string()
      .describe('The contract ID to use for the transaction'),
    secretKey: z
      .string()
      .describe('The secret key of the account to sign the transaction'),
  },
  async ({ transactionXdr, contractId, secretKey }) => {
    try {
      // Validate the contract ID
      if (!contractId.startsWith('C')) {
        throw new Error('Contract ID must start with "C"');
      }

      if (contractId.length !== 56) {
        throw new Error('Contract ID must be 56 characters long');
      }

      const keypair = Keypair.fromSecret(secretKey);
      const sacClient = await createSACClient(
        contractId.toUpperCase(),
        process.env.NETWORK_PASSPHRASE!,
        process.env.RPC_URL!
      );
      const result = sacClient.txFromXDR(transactionXdr);

      let isReadCall = false;
      try {
        // Simulation is necessary to obtain some insights about the transaction
        await result.simulate();
        isReadCall = result.isReadCall;
      } catch (e) {
        // Ignore simulation errors
      }

      if (isReadCall) {
        const res = await submitToLaunchtube(result.toXDR());
        const meta = xdr.TransactionMeta.fromXDR(res.resultMetaXdr, 'base64');
        const parsedResult = scValToNative(
          meta.v3().sorobanMeta()!.returnValue()
        );
        return {
          content: [
            { type: 'text', text: 'Transaction sent successfully!' },
            { type: 'text', text: JSON.stringify(parsedResult) },
          ],
        };
      }

      const { shouldSignWithSigner, walletContractId } =
        await shouldSignWithWalletSigner(result, contractId);

      // Signing with a passkey wallet
      if (shouldSignWithSigner && walletContractId) {
        const passkeyWallet = getPasskeyWallet(walletContractId);
        const signedTx = await passkeyWallet.sign(transactionXdr, { keypair });
        try {
          const res = await passkeyServer.send(signedTx);
          const meta = xdr.TransactionMeta.fromXDR(res.resultMetaXdr, 'base64');
          const parsedResult = scValToNative(
            meta.v3().sorobanMeta()!.returnValue()
          );
          return {
            content: [
              { type: 'text', text: 'Transaction sent successfully!' },
              { type: 'text', text: JSON.stringify(parsedResult) },
            ],
          };
        } catch (e) {
          let invalidAuth = false;
          if (
            (e as { error?: string })?.error?.includes(
              'Error(Auth, InvalidAction)'
            )
          ) {
            invalidAuth = true;
          }
          return {
            content: [
              {
                type: 'text',
                text: invalidAuth
                  ? 'Transaction failed: Insufficient permissions to execute the transaction'
                  : 'Transaction failed',
              },
            ],
          };
        }
      }
      // Signing with a regular Stellar wallet
      const server = new rpc.Server(process.env.RPC_URL!, { allowHttp: true });

      const ledgerSeq = (await server.getLatestLedger()).sequence;
      const validUntilLedger = ledgerSeq + 100;

      await result.signAuthEntries({
        address: keypair.publicKey(),
        authorizeEntry: async (entry) => {
          return authorizeEntry(
            entry,
            keypair,
            validUntilLedger,
            process.env.NETWORK_PASSPHRASE!
          );
        },
      });

      // Now sign the transaction envelope
      await result.sign({
        signTransaction: basicNodeSigner(
          keypair,
          process.env.NETWORK_PASSPHRASE!
        ).signTransaction,
      });

      // Send through Launchtube
      const res = await submitToLaunchtube(result.toXDR());
      const meta = xdr.TransactionMeta.fromXDR(res.resultMetaXdr, 'base64');
      const parsedResult = scValToNative(
        meta.v3().sorobanMeta()!.returnValue()
      );
      return {
        content: [
          { type: 'text', text: 'Transaction sent successfully!' },
          { type: 'text', text: JSON.stringify(parsedResult) },
        ],
      };
    } catch (error) {
      if (error instanceof Error) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  error: 'Transaction failed',
                  message: error.message,
                  details: error,
                },
                null,
                2
              ),
            },
          ],
        };
      }
      throw error;
    }
  }
);

server.tool(
  'submit-signed-xdr',
  'Submit a signed XDR transaction to the Stellar network.',
  { xdr: z.string().describe('The signed XDR transaction to submit') },
  async ({ xdr }) => {
    try {
      const res = await submitToLaunchtube(xdr);
      const meta = res.TransactionMeta.fromXDR(res.resultMetaXdr, 'base64');
      const parsedResult = scValToNative(
        meta.v3().sorobanMeta()!.returnValue()
      );
      return {
        content: [
          { type: 'text', text: 'Transaction submitted successfully!' },
          { type: 'text', text: JSON.stringify(parsedResult) },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error: 'Transaction failed',
              message: error instanceof Error ? error.message : 'Unknown error',
              details: error,
            }),
          },
        ],
      };
    }
  }
);

async function main() {
  try {
    // Initialize MCP transport
    const transport = new StdioServerTransport();
    await server.connect(transport);
  } catch (error) {
    throw error;
  }
}

main().catch(() => {
  process.exit(1);
});

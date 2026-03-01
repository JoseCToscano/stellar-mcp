/**
 * Deploy a PasskeyKit smart wallet contract on Stellar testnet.
 *
 * This is a one-time setup script.  Run it once, then paste the output values
 * into your .env file and restart the MCP server with WALLET_WASM_HASH and
 * WALLET_SIGNER_SECRET set.
 *
 * Prerequisites:
 *   1. The PasskeyKit wallet WASM must be uploaded to testnet.
 *
 *      Known testnet WASM hash (pre-uploaded, passkey-kit v0.5.0):
 *        b3eba29c256a2458faff84fc872226d29df37ad05a6a1c0efe2a95817d6765ec
 *
 *      If the hash above gives a 404 (testnet resets quarterly), build and
 *      upload the WASM yourself:
 *
 *        # 1. Clone and build
 *        git clone https://github.com/kalepail/passkey-kit /tmp/passkey-kit
 *        cd /tmp/passkey-kit/contracts
 *        stellar contract build --package smart-wallet --out-dir ./out
 *        stellar contract optimize --wasm ./out/smart_wallet.wasm
 *
 *        # 2. Upload (note the hash printed)
 *        stellar contract upload \
 *          --wasm ./out/smart_wallet.optimized.wasm \
 *          --source me --network testnet
 *
 *   2. Set WASM_HASH and DEPLOYER_SECRET before running:
 *        DEPLOYER_SECRET=$(stellar keys show me) \
 *        WASM_HASH=<hash-from-step-1> \
 *        npx tsx src/deploy-passkey-wallet.ts
 *
 * Output:
 *   WALLET_WASM_HASH    → add to server .env  (WALLET_WASM_HASH=...)
 *   WALLET_CONTRACT_ID  → add to node-app .env (WALLET_CONTRACT_ID=...)
 *   WALLET_SIGNER_SECRET→ add to server .env  (WALLET_SIGNER_SECRET=...)
 *   FEE_PAYER_SECRET    → add to node-app .env (reuse DEPLOYER_SECRET)
 *
 * Then restart the server:
 *   WALLET_WASM_HASH=... WALLET_SIGNER_SECRET=... \
 *   USE_HTTP=true PORT=3001 node dist/index.js
 */

import { Keypair, rpc, TransactionBuilder } from "@stellar/stellar-sdk";
import { basicNodeSigner } from "@stellar/stellar-sdk/contract";
import { Buffer } from "buffer";
import { PasskeyClient } from "passkey-kit";

const RPC_URL            = process.env.RPC_URL            ?? "https://soroban-testnet.stellar.org";
const NETWORK_PASSPHRASE = process.env.NETWORK_PASSPHRASE ?? "Test SDF Network ; September 2015";

async function main(): Promise<void> {
  const wasmHash       = process.env.WASM_HASH;
  const deployerSecret = process.env.DEPLOYER_SECRET;

  if (!wasmHash) {
    console.error("Error: WASM_HASH is required");
    console.error("  See the comments at the top of this file for upload instructions.");
    process.exit(1);
  }
  if (!deployerSecret) {
    console.error("Error: DEPLOYER_SECRET is required");
    console.error("  Set it with: export DEPLOYER_SECRET=$(stellar keys show me)");
    process.exit(1);
  }

  const deployer = Keypair.fromSecret(deployerSecret);
  // Fresh Ed25519 keypair — its public key is registered in the wallet contract,
  // its secret goes into WALLET_SIGNER_SECRET on the MCP server so it can sign
  // contract auth entries on behalf of the smart wallet.
  const signer = Keypair.random();

  console.log("Deploying PasskeyKit smart wallet...\n");
  console.log("  Deployer :", deployer.publicKey());
  console.log("  Network  :", NETWORK_PASSPHRASE);
  console.log("  RPC      :", RPC_URL);
  console.log("  WASM     :", wasmHash);
  console.log();

  const assembledTx = await PasskeyClient.deploy(
    {
      signer: {
        tag: "Ed25519",
        values: [
          signer.rawPublicKey(),
          [undefined], // SignerExpiration — no expiry
          [undefined], // SignerLimits     — no limits
          { tag: "Persistent", values: undefined }, // SignerStorage
        ],
      },
    },
    {
      rpcUrl:            RPC_URL,
      networkPassphrase: NETWORK_PASSPHRASE,
      wasmHash:          Buffer.from(wasmHash, "hex"),
      publicKey:         deployer.publicKey(),
      salt:              Buffer.from(Keypair.random().rawPublicKey()),
      timeoutInSeconds:  30,
    }
  );

  // contractId is deterministic (derived from deployer + salt) — capture before send
  const contractId = assembledTx.result.options.contractId;

  await assembledTx.sign({
    signTransaction: basicNodeSigner(deployer, NETWORK_PASSPHRASE).signTransaction,
  });

  // Submit using stellar-sdk v14 directly — passkey-kit-sdk bundles an older
  // stellar-sdk internally that can't parse protocol-23 transaction results.
  const server = new rpc.Server(RPC_URL, { allowHttp: RPC_URL.startsWith("http:") });
  const tx = TransactionBuilder.fromXDR(assembledTx.signed!.toXDR(), NETWORK_PASSPHRASE);
  const sendResponse = await server.sendTransaction(tx);

  if (sendResponse.status !== "PENDING") {
    throw new Error(`Submission failed (${sendResponse.status}): ${JSON.stringify(sendResponse)}`);
  }

  // Poll until confirmed
  let txResponse: rpc.Api.GetTransactionResponse | undefined;
  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 500));
    txResponse = await server.getTransaction(sendResponse.hash);
    if (txResponse.status !== "NOT_FOUND") break;
  }

  if (!txResponse || txResponse.status !== "SUCCESS") {
    throw new Error(`Transaction did not confirm (${txResponse?.status})`);
  }

  console.log("Wallet deployed successfully!\n");
  console.log("  Transaction :", sendResponse.hash);
  console.log("  Contract ID :", contractId);
  console.log();
  console.log("Add these to your .env files:\n");
  console.log("  # MCP server .env");
  console.log(`  WALLET_WASM_HASH=${wasmHash}`);
  console.log(`  WALLET_SIGNER_SECRET=${signer.secret()}`);
  console.log();
  console.log("  # node-app .env");
  console.log(`  WALLET_CONTRACT_ID=${contractId}`);
  console.log(`  FEE_PAYER_SECRET=${deployerSecret}`);
}

main().catch((err: unknown) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});

/**
 * Deploy a PasskeyKit smart wallet contract on Stellar testnet.
 *
 * This is a one-time setup script.  Run it once, then paste the output values
 * into your .env file and restart the MCP server with WALLET_WASM_HASH and
 * WALLET_SIGNER_SECRET set.
 *
 * Prerequisites:
 *   1. The PasskeyKit wallet WASM must be uploaded to testnet.
 *      Upload it from the passkey-kit repo:
 *        stellar contract upload \
 *          --wasm path/to/smart_wallet.wasm \
 *          --source me --network testnet
 *      Note the WASM hash printed.
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
 *   FEE_PAYER_SECRET    → add to node-app .env (FEE_PAYER_SECRET=...)
 *
 * Then restart the server:
 *   WALLET_WASM_HASH=... WALLET_SIGNER_SECRET=... \
 *   USE_HTTP=true PORT=3001 node dist/index.js
 */

import { Keypair } from "@stellar/stellar-sdk";

async function main(): Promise<void> {
  const wasmHash = process.env.WASM_HASH;
  const deployerSecret = process.env.DEPLOYER_SECRET;

  if (!wasmHash) {
    console.error("Error: WASM_HASH is required");
    console.error(
      "  Upload the wallet WASM first:\n" +
        "    stellar contract upload --wasm smart_wallet.wasm --source me --network testnet"
    );
    process.exit(1);
  }
  if (!deployerSecret) {
    console.error("Error: DEPLOYER_SECRET is required");
    console.error("  Set it with: export DEPLOYER_SECRET=$(stellar keys show me)");
    process.exit(1);
  }

  // Use the hackathon deploy script if available (it has passkey-kit-sdk installed)
  const hackathonScript =
    "/Users/apple/dev/hackathon/stellar/scallfold-copilot/demo/fouth-demo/deploy-wallet.ts";

  const { execSync } = await import("child_process");

  console.log("Deploying PasskeyKit wallet via hackathon deploy script...\n");

  try {
    const output = execSync(
      `DEPLOYER_SECRET=${deployerSecret} npx tsx ${hackathonScript} ${wasmHash}`,
      { encoding: "utf-8", env: { ...process.env, DEPLOYER_SECRET: deployerSecret } }
    );
    console.log(output);
  } catch (err: unknown) {
    console.error("Deployment failed:", err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

main().catch((err: unknown) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});

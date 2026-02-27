/**
 * Smoke test for @stellar-mcp/client — verifies the SDK works as an installed package.
 *
 * Usage:
 *   cp .env.example .env       (fill in credentials)
 *   npm run smoke              (auto-generates src/mcp-types.ts then runs this test)
 *
 * Scenarios tested:
 *   Steps 1-5  : Read-only (always run — no credentials needed)
 *   Steps 6-8  : secretKey write path (TEST_ADMIN_ADDRESS + TEST_SECRET_KEY required)
 *   Step  9    : PasskeyKit signing  (WALLET_CONTRACT_ID + FEE_PAYER_SECRET required,
 *                server must be started with WALLET_WASM_HASH + WALLET_SIGNER_SECRET)
 *                → Run src/deploy-passkey-wallet.ts once to get these values.
 */

import { createRequire } from "module";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// Load .env before any imports that use environment variables
const require = createRequire(import.meta.url);
const dotenv = require("dotenv") as {
  config: (opts: { path: string }) => void;
};
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "..", ".env") });

// Generated typed client — run `npm run generate` first to create this file.
import { createMCPClient } from "./mcp-types.js";
import { secretKeySigner } from "@stellar-mcp/client/signers/secret";
import { passkeyKitSigner } from "@stellar-mcp/client/signers/passkey";

// ─── Config ───────────────────────────────────────────────────────────────────

const MCP_URL = process.env.MCP_URL ?? "http://localhost:3001/mcp";
const RPC_URL = process.env.RPC_URL ?? "https://soroban-testnet.stellar.org";
const NETWORK_PASSPHRASE =
  process.env.NETWORK_PASSPHRASE ?? "Test SDF Network ; September 2015";
const TEST_ADMIN_ADDRESS = process.env.TEST_ADMIN_ADDRESS ?? "";
const TEST_SECRET_KEY = process.env.TEST_SECRET_KEY ?? "";
const WALLET_CONTRACT_ID = process.env.WALLET_CONTRACT_ID ?? "";
const FEE_PAYER_SECRET = process.env.FEE_PAYER_SECRET ?? "";

const HAS_WRITE_CREDS = Boolean(TEST_ADMIN_ADDRESS && TEST_SECRET_KEY);
const HAS_PASSKEY_CREDS = Boolean(WALLET_CONTRACT_ID && FEE_PAYER_SECRET);

// ─── Helpers ──────────────────────────────────────────────────────────────────

let passed = 0;

function pass(label: string, detail?: string): void {
  console.log(`  ✓ ${label}${detail ? ` — ${detail}` : ""}`);
  passed++;
}

function fail(label: string, err: unknown): never {
  console.error(`  ✗ ${label}`);
  console.error(`    ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log("\n@stellar-mcp/client smoke test\n");
  console.log("Config:");
  console.log(`  MCP_URL          : ${MCP_URL}`);
  console.log(`  RPC_URL          : ${RPC_URL}`);
  console.log(`  NETWORK          : ${NETWORK_PASSPHRASE}`);
  console.log(
    `  secretKey write  : ${HAS_WRITE_CREDS ? "yes" : "no (steps 6-8 skipped)"}`
  );
  console.log(
    `  passkey signing  : ${HAS_PASSKEY_CREDS ? "yes" : "no (step 9 skipped — run deploy-passkey-wallet.ts first)"}`
  );
  console.log();

  // ── Step 1: Instantiate typed client via generated factory ──────────────────
  let client: ReturnType<typeof createMCPClient>;
  try {
    client = createMCPClient({
      url: MCP_URL,
      networkPassphrase: NETWORK_PASSPHRASE,
      rpcUrl: RPC_URL,
    });
    pass("createMCPClient (generated factory)");
  } catch (err) {
    fail("createMCPClient instantiate", err);
  }

  try {
    // ── Step 2: listTools ─────────────────────────────────────────────────────
    const tools = await client!.listTools();
    if (tools.length === 0) throw new Error("Expected at least one tool");
    pass(
      "listTools",
      `${tools.length} tools: ${tools.map((t) => t.name).join(", ")}`
    );

    // ── Step 3: get-admin ─────────────────────────────────────────────────────
    // Tool name is autocompleted — try changing it to 'get-adminn' to see a compile error.
    // With outputSchema, data is the full { xdr, simulationResult } envelope.
    // The actual contract return value is in simulationResult.
    const adminResult = await client!.call("get-admin");
    const admin = adminResult.simulationResult as string;
    if (typeof admin !== "string" || !admin.startsWith("G")) {
      throw new Error(
        `Expected a G… address, got: ${JSON.stringify(adminResult.data)}`
      );
    }
    pass("get-admin", admin);

    // ── Step 4: get-token-count ───────────────────────────────────────────────
    const countResult = await client!.call("get-token-count");
    const countNum = Number(countResult.simulationResult);
    if (!Number.isFinite(countNum) || countNum < 0) {
      throw new Error(
        `Expected non-negative number, got: ${JSON.stringify(countResult.simulationResult)}`
      );
    }
    pass("get-token-count", String(countNum));

    // ── Step 5: get-deployed-tokens ───────────────────────────────────────────
    const tokensResult = await client!.call("get-deployed-tokens");
    const tokens = tokensResult.simulationResult;
    if (!Array.isArray(tokens)) {
      throw new Error(`Expected array, got: ${typeof tokens}`);
    }
    pass("get-deployed-tokens", `${tokens.length} tokens`);

    // ─────────────────────────────────────────────────────────────────────────
    // secretKey write path
    // Requires: TEST_ADMIN_ADDRESS + TEST_SECRET_KEY in .env
    // ─────────────────────────────────────────────────────────────────────────
    if (HAS_WRITE_CREDS) {
      // ── Step 6: deploy-token — get XDR for signing ────────────────────────
      // Args are fully type-checked — the compiler catches missing or wrong fields.
      const salt = crypto.randomUUID().replace(/-/g, "").padEnd(64, "0");
      const deployResult = await client!.call("deploy-token", {
        deployer: TEST_ADMIN_ADDRESS,
        config: {
          admin: TEST_ADMIN_ADDRESS,
          asset: null,
          cap: null,
          decimals: 7,
          decimals_offset: null,
          initial_supply: "0",
          manager: TEST_ADMIN_ADDRESS,
          name: `SmokeTest_${Date.now()}`,
          salt,
          symbol: "SMK",
          token_type: { tag: "Pausable" },
        },
      });

      if (!deployResult.xdr || deployResult.xdr.length === 0) {
        throw new Error("deploy-token did not return XDR");
      }
      pass("deploy-token", `xdr length: ${deployResult.xdr.length}`);

      // ── Step 7: sign and submit with secretKeySigner ──────────────────────
      // secretKeySigner delegates to the server's sign-and-submit tool:
      //   server fetches fresh sequence, signs auth entries, signs envelope, submits.
      const submitResult = await client!.signAndSubmit(deployResult.xdr, {
        signer: secretKeySigner(TEST_SECRET_KEY),
      });

      if (submitResult.status !== "SUCCESS") {
        throw new Error(`Expected SUCCESS, got: ${submitResult.status}`);
      }
      pass("signAndSubmit (secretKeySigner)", `hash: ${submitResult.hash}`);

      // ── Step 8: waitForConfirmation ───────────────────────────────────────
      // Explicitly tests the polling API — polls Soroban RPC until the
      // transaction appears as SUCCESS (or throws on FAILED).
      // The transaction is already confirmed at this point, so this returns fast.
      const confirmedResult = await client!.waitForConfirmation(
        submitResult.hash
      );
      if (confirmedResult.status !== "SUCCESS") {
        throw new Error(
          `waitForConfirmation returned: ${confirmedResult.status}`
        );
      }
      pass("waitForConfirmation", `status: ${confirmedResult.status}`);
    } else {
      console.log("  ~ deploy-token              (skipped — no TEST_SECRET_KEY)");
      console.log("  ~ signAndSubmit secretKey   (skipped — no TEST_SECRET_KEY)");
      console.log("  ~ waitForConfirmation       (skipped — no TEST_SECRET_KEY)");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PasskeyKit smart wallet path
    // Requires: WALLET_CONTRACT_ID + FEE_PAYER_SECRET in .env
    //           Server must be started with WALLET_WASM_HASH + WALLET_SIGNER_SECRET
    // Setup:    npx tsx src/deploy-passkey-wallet.ts   (one-time)
    // ─────────────────────────────────────────────────────────────────────────
    if (HAS_PASSKEY_CREDS) {
      // ── Step 9a: deploy-token — get XDR for PasskeyKit signing ───────────
      const salt = crypto.randomUUID().replace(/-/g, "").padEnd(64, "0");
      // deployer must be WALLET_CONTRACT_ID so PasskeyKit signs the contract auth entries
      const passkeyDeployResult = await client!.call("deploy-token", {
        deployer: WALLET_CONTRACT_ID,
        config: {
          admin: WALLET_CONTRACT_ID,
          asset: null,
          cap: null,
          decimals: 7,
          decimals_offset: null,
          initial_supply: "0",
          manager: WALLET_CONTRACT_ID,
          name: `PasskeyTest_${Date.now()}`,
          salt,
          symbol: "PSK",
          token_type: { tag: "Pausable" },
        },
      });

      if (!passkeyDeployResult.xdr || passkeyDeployResult.xdr.length === 0) {
        throw new Error("deploy-token (passkey path) did not return XDR");
      }
      pass("deploy-token (passkey path)", `xdr length: ${passkeyDeployResult.xdr.length}`);

      // ── Step 9b: sign and submit with passkeyKitSigner ───────────────────
      // passkeyKitSigner delegates to the server's sign-and-submit tool with
      // walletContractId — the server uses WALLET_SIGNER_SECRET (from its env)
      // to sign the auth entries, and FEE_PAYER_SECRET to sign the envelope.
      const passkeySubmitResult = await client!.signAndSubmit(
        passkeyDeployResult.xdr,
        {
          signer: passkeyKitSigner({
            walletContractId: WALLET_CONTRACT_ID,
            feePayerSecret: FEE_PAYER_SECRET,
          }),
        }
      );

      if (passkeySubmitResult.status !== "SUCCESS") {
        throw new Error(
          `Expected SUCCESS, got: ${passkeySubmitResult.status}`
        );
      }
      pass("signAndSubmit (passkeyKitSigner)", `hash: ${passkeySubmitResult.hash}`);
    } else {
      console.log("  ~ signAndSubmit passkey     (skipped — run deploy-passkey-wallet.ts first)");
    }
  } catch (err) {
    console.error("\nSmoke test failed:");
    console.error(err instanceof Error ? err.stack : err);
    process.exit(1);
  } finally {
    client!.close();
  }

  console.log(`\n✓ All smoke tests passed (${passed} checks)\n`);
}

main().catch((err: unknown) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});

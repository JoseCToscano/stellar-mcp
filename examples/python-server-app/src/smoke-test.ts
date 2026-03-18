/**
 * Smoke test for @stellar-mcp/client targeting a **Python-generated** MCP server.
 *
 * This mirrors the node-app smoke test but omits PasskeyKit (step 9) since
 * the Python server generator does not support PasskeyKit signing.
 *
 * Usage:
 *   cp .env.example .env       (fill in credentials)
 *   npm run smoke              (auto-generates src/mcp-types.ts then runs this test)
 *
 * Scenarios tested:
 *   Steps 1-5  : Read-only (always run — no credentials needed)
 *   Steps 6-8  : secretKey write path (TEST_ADMIN_ADDRESS + TEST_SECRET_KEY required)
 *
 * Python server limitation:
 *   PasskeyKit signing is not available — the Python MCP server generator does not
 *   produce the wallet-related tools (sign-and-submit-with-passkey, etc.).
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

// ─── Config ───────────────────────────────────────────────────────────────────

const MCP_URL = process.env.MCP_URL ?? "http://localhost:3003/mcp";
const RPC_URL = process.env.RPC_URL ?? "https://soroban-testnet.stellar.org";
const NETWORK_PASSPHRASE =
  process.env.NETWORK_PASSPHRASE ?? "Test SDF Network ; September 2015";
const TEST_ADMIN_ADDRESS = process.env.TEST_ADMIN_ADDRESS ?? "";
const TEST_SECRET_KEY = process.env.TEST_SECRET_KEY ?? "";

const HAS_WRITE_CREDS = Boolean(TEST_ADMIN_ADDRESS && TEST_SECRET_KEY);

// ─── Helpers ──────────────────────────────────────────────────────────────────

let passed = 0;

function pass(label: string, detail?: string): void {
  console.log(`  \u2713 ${label}${detail ? ` \u2014 ${detail}` : ""}`);
  passed++;
}

function fail(label: string, err: unknown): never {
  console.error(`  \u2717 ${label}`);
  console.error(`    ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log("\n@stellar-mcp/client smoke test (Python server)\n");
  console.log("Config:");
  console.log(`  MCP_URL          : ${MCP_URL}`);
  console.log(`  RPC_URL          : ${RPC_URL}`);
  console.log(`  NETWORK          : ${NETWORK_PASSPHRASE}`);
  console.log(
    `  secretKey write  : ${HAS_WRITE_CREDS ? "yes" : "no (steps 6-8 skipped)"}`
  );
  console.log(
    `  passkey signing  : not supported (Python server limitation)`
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

    // ── Step 3: get_admin ──────────────────────────────────────────────────────
    // Python server uses underscores in tool names (get_admin, not get-admin).
    const adminResult = await client!.call("get_admin");
    const admin = adminResult.simulationResult as string;
    if (typeof admin !== "string" || !admin.startsWith("G")) {
      throw new Error(
        `Expected a G\u2026 address, got: ${JSON.stringify(adminResult.data)}`
      );
    }
    pass("get_admin", admin);

    // ── Step 4: get_token_count ─────────────────────────────────────────────
    const countResult = await client!.call("get_token_count");
    const countNum = Number(countResult.simulationResult);
    if (!Number.isFinite(countNum) || countNum < 0) {
      throw new Error(
        `Expected non-negative number, got: ${JSON.stringify(countResult.simulationResult)}`
      );
    }
    pass("get_token_count", String(countNum));

    // ── Step 5: get_deployed_tokens ─────────────────────────────────────────
    const tokensResult = await client!.call("get_deployed_tokens");
    const tokens = tokensResult.simulationResult;
    if (!Array.isArray(tokens)) {
      throw new Error(`Expected array, got: ${typeof tokens}`);
    }
    pass("get_deployed_tokens", `${tokens.length} tokens`);

    // ─────────────────────────────────────────────────────────────────────────
    // secretKey write path
    // Requires: TEST_ADMIN_ADDRESS + TEST_SECRET_KEY in .env
    // ─────────────────────────────────────────────────────────────────────────
    if (HAS_WRITE_CREDS) {
      // ── Step 6: deploy_token — get XDR for signing ─────────────────────────
      const salt = crypto.randomUUID().replace(/-/g, "").padEnd(64, "0");
      const deployResult = await client!.call("deploy_token", {
        deployer: TEST_ADMIN_ADDRESS,
        config: {
          admin: TEST_ADMIN_ADDRESS,
          asset: null,
          cap: null,
          decimals: 7,
          decimals_offset: null,
          initial_supply: "0",
          manager: TEST_ADMIN_ADDRESS,
          name: `PySmokeTest_${Date.now()}`,
          salt,
          symbol: "PYS",
          token_type: { tag: "Pausable" },
        },
      });

      if (!deployResult.xdr || deployResult.xdr.length === 0) {
        throw new Error("deploy-token did not return XDR");
      }
      pass("deploy_token", `xdr length: ${deployResult.xdr.length}`);

      // ── Step 7: sign and submit with secretKeySigner ──────────────────────
      const submitResult = await client!.signAndSubmit(deployResult.xdr, {
        signer: secretKeySigner(TEST_SECRET_KEY),
      });

      if (submitResult.status !== "SUCCESS") {
        throw new Error(`Expected SUCCESS, got: ${submitResult.status}`);
      }
      pass("signAndSubmit (secretKeySigner)", `hash: ${submitResult.hash}`);

      // ── Step 8: waitForConfirmation ───────────────────────────────────────
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
      console.log("  ~ deploy_token              (skipped \u2014 no TEST_SECRET_KEY)");
      console.log("  ~ signAndSubmit secretKey   (skipped \u2014 no TEST_SECRET_KEY)");
      console.log("  ~ waitForConfirmation       (skipped \u2014 no TEST_SECRET_KEY)");
    }

    // PasskeyKit is not supported by the Python MCP server generator.
    // The node-app example covers PasskeyKit signing (step 9) if needed.
    console.log("  ~ signAndSubmit passkey     (not supported \u2014 Python server limitation)");
  } catch (err) {
    console.error("\nSmoke test failed:");
    console.error(err instanceof Error ? err.stack : err);
    process.exit(1);
  } finally {
    client!.close();
  }

  console.log(`\n\u2713 All smoke tests passed (${passed} checks)\n`);
}

main().catch((err: unknown) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});

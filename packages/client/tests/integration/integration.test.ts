/**
 * Integration tests for @stellar-mcp/client against a real MCP server.
 *
 * Prerequisites:
 *   1. Build the token-factory reference server:
 *      cd docs/final-hey && npm run build
 *   2. Start it in HTTP mode:
 *      USE_HTTP=true PORT=3001 node dist/index.js
 *
 * Usage:
 *   # Read-only tests (no secret key required)
 *   RUN_INTEGRATION=1 npm run test:integration
 *
 *   # Full suite including write + submit
 *   RUN_INTEGRATION=1 TEST_ADMIN_ADDRESS=G... TEST_SECRET_KEY=S... npm run test:integration
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MCPClient } from '../../src/client.js';
import { secretKeySigner } from '../../src/signers/secret.js';

// ─── Environment ──────────────────────────────────────────────────────────────

const RUN_INTEGRATION = process.env.RUN_INTEGRATION === '1';
const MCP_URL = process.env.MCP_URL ?? 'http://localhost:3001/mcp';
const RPC_URL = process.env.RPC_URL ?? 'https://soroban-testnet.stellar.org';
const NETWORK_PASSPHRASE = process.env.NETWORK_PASSPHRASE ?? 'Test SDF Network ; September 2015';
const TEST_ADMIN_ADDRESS = process.env.TEST_ADMIN_ADDRESS ?? '';
const TEST_SECRET_KEY = process.env.TEST_SECRET_KEY ?? '';

const HAS_WRITE_CREDS = Boolean(TEST_ADMIN_ADDRESS && TEST_SECRET_KEY);

// ─── Suite ────────────────────────────────────────────────────────────────────

describe.skipIf(!RUN_INTEGRATION)('MCPClient integration', () => {
  let client: MCPClient;

  beforeAll(() => {
    client = new MCPClient({
      url: MCP_URL,
      networkPassphrase: NETWORK_PASSPHRASE,
      rpcUrl: RPC_URL,
    });
  });

  afterAll(() => {
    client.close();
  });

  // ─── Server health ──────────────────────────────────────────────────────────

  it('server health endpoint returns ok', async () => {
    // The health endpoint is at the base URL without /mcp suffix
    const healthUrl = MCP_URL.replace(/\/mcp$/, '/health');
    const response = await fetch(healthUrl);
    expect(response.ok).toBe(true);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body.status).toBe('ok');
  });

  // ─── Read-only tools ────────────────────────────────────────────────────────

  it('listTools returns array with known tool names', async () => {
    const tools = await client.listTools();
    expect(Array.isArray(tools)).toBe(true);
    expect(tools.length).toBeGreaterThan(0);

    const names = tools.map((t) => t.name);
    // Every generated server includes these static tools
    expect(names).toContain('sign-and-submit');
    // Token-factory specific tools
    expect(names).toContain('get-admin');
    expect(names).toContain('get-token-count');
    expect(names).toContain('get-deployed-tokens');
    expect(names).toContain('deploy-token');
  });

  it('listTools returns outputSchema for contract tools', async () => {
    const tools = await client.listTools();
    const getAdmin = tools.find((t) => t.name === 'get-admin');
    expect(getAdmin).toBeDefined();
    // Server emits outputSchema via registerTool — client should pass it through
    expect(getAdmin?.outputSchema).toBeDefined();
    expect(typeof getAdmin?.outputSchema).toBe('object');
  });

  it('get-admin returns a G… Stellar address', async () => {
    // With structuredContent, data is the full envelope { xdr, simulationResult }
    const result = await client.call('get-admin');
    const admin = result.simulationResult as string;
    expect(typeof admin).toBe('string');
    expect(admin.startsWith('G')).toBe(true);
    expect(admin.length).toBe(56);
  });

  it('get-token-count returns a non-negative number', async () => {
    const result = await client.call('get-token-count');
    // simulationResult holds the contract return value (u32 serialised as number)
    const count = Number(result.simulationResult);
    expect(Number.isFinite(count)).toBe(true);
    expect(count).toBeGreaterThanOrEqual(0);
  });

  it('get-deployed-tokens returns an array', async () => {
    const result = await client.call('get-deployed-tokens');
    expect(Array.isArray(result.simulationResult)).toBe(true);
  });

  // ─── Write tests (requires TEST_ADMIN_ADDRESS + TEST_SECRET_KEY) ────────────

  describe.skipIf(!HAS_WRITE_CREDS)('write operations', () => {
    it('deploy-token returns a non-empty XDR string', async () => {
      const salt = crypto.randomUUID().replace(/-/g, '').padEnd(64, '0');

      const result = await client.call('deploy-token', {
        deployer: TEST_ADMIN_ADDRESS,
        config: {
          admin: TEST_ADMIN_ADDRESS,
          decimals: 7,
          initial_supply: '0',
          manager: TEST_ADMIN_ADDRESS,
          name: `IntegTest_${Date.now()}`,
          salt,
          symbol: 'ITK',
          token_type: { tag: 'Pausable' },
        },
      });

      expect(typeof result.xdr).toBe('string');
      expect((result.xdr as string).length).toBeGreaterThan(0);
    });

    it('signAndSubmit with secretKeySigner returns SUCCESS status', async () => {
      const salt = crypto.randomUUID().replace(/-/g, '').padEnd(64, '0');

      // Step 1 — get an XDR to sign
      const { xdr } = await client.call('deploy-token', {
        deployer: TEST_ADMIN_ADDRESS,
        config: {
          admin: TEST_ADMIN_ADDRESS,
          decimals: 7,
          initial_supply: '0',
          manager: TEST_ADMIN_ADDRESS,
          name: `IntegTest_Submit_${Date.now()}`,
          salt,
          symbol: 'ISK',
          token_type: { tag: 'Pausable' },
        },
      });

      expect(typeof xdr).toBe('string');

      // Step 2 — sign and submit via server
      const result = await client.signAndSubmit(xdr!, {
        signer: secretKeySigner(TEST_SECRET_KEY),
      });

      expect(result.status).toBe('SUCCESS');
      expect(typeof result.hash).toBe('string');
      expect((result.hash as string).length).toBeGreaterThan(0);
    });
  });
});

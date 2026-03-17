import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts'],
    // Provide required env vars so config.ts doesn't throw during import
    env: {
      MCP_SERVER_URL: 'http://localhost:3000/mcp',
      RPC_URL: 'https://soroban-testnet.stellar.org',
      NETWORK_PASSPHRASE: 'Test SDF Network ; September 2015',
    },
  },
});

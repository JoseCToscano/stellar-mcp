// src/config.ts
//
// Loads .env via dotenv and validates required environment variables.
// Exports a typed Config object consumed by the rest of the application.
import 'dotenv/config';
import { DEFAULT_RPC_URL, DEFAULT_NETWORK_PASSPHRASE } from './constants.js';
export const config = {
    mcpUrl: requireEnv('MCP_SERVER_URL'),
    rpcUrl: process.env.RPC_URL ?? DEFAULT_RPC_URL,
    networkPassphrase: process.env.NETWORK_PASSPHRASE ?? DEFAULT_NETWORK_PASSPHRASE,
    signerSecret: process.env.SIGNER_SECRET || undefined,
};
function requireEnv(key) {
    const val = process.env[key];
    if (!val)
        throw new Error(`Missing required env var: ${key}\nCopy .env.example to .env`);
    return val;
}

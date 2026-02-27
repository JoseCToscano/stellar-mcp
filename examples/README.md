# Stellar MCP — Examples

Two working examples that show how to use `@stellar-mcp/client` against a live Stellar MCP server.

Both examples target the **Token Factory** contract on Stellar testnet:
`CAHLJEQUCNTV7JPAPCMLCBIHOX7FFB57DUARJ6XGTW27FPCVKKY7JM2A`

---

## Prerequisites

1. A running MCP server (generated with `stellar mcp generate`)
2. Node.js 18+

Start your server:
```bash
USE_HTTP=true PORT=3001 node dist/index.js
```

---

## Examples

### `web-app` — Browser dApp (Vite + Freighter)

A Token Factory dApp with two tabs:

- **Read** — query factory state (admin, token count, deployed tokens) — no wallet needed
- **Write** — deploy a new Soroban token signed via Freighter browser extension

**Key SDK patterns:**
```ts
import { MCPClient, connectFreighter } from '@stellar-mcp/client';

// Connect wallet once — get address for UI and signer for transactions
const { address, signer } = await connectFreighter(NETWORK_PASSPHRASE);

// Read
const { simulationResult } = await client.call('get-token-count');

// Write
const { xdr } = await client.call('deploy-token', { deployer, config });
const result  = await client.signAndSubmit(xdr!, { signer });
```

**Setup:**
```bash
cd web-app
npm install
npm run dev        # starts at http://localhost:5173
```

Configure in `.env` (defaults to testnet, no changes needed to get started).

> The Vite proxy routes `/mcp` → `localhost:3001` to avoid CORS — no extra config needed.

---

### `node-app` — Node.js Script (secretKeySigner)

A smoke-test script and PasskeyKit wallet deployer for server-side / CI usage.

**Key SDK patterns:**
```ts
import { MCPClient, secretKeySigner } from '@stellar-mcp/client';

// Read
const { simulationResult: admin } = await client.call('get-admin');

// Write — secret key signs server-side, never leaves your environment
const { xdr } = await client.call('deploy-token', { deployer, config });
const result  = await client.signAndSubmit(xdr!, {
  signer: secretKeySigner(process.env.SIGNER_SECRET!),
});
```

**Setup:**
```bash
cd node-app
cp .env.example .env   # fill in MCP_URL and SIGNER_SECRET
npm install
npm run smoke          # runs smoke-test.ts against your MCP server
```

---

## SDK Reference

Full documentation: [`packages/client/README.md`](../packages/client/README.md)

```bash
npm install @stellar-mcp/client
```

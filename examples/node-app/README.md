# node-app — SDK smoke test

Node.js example demonstrating `@stellar-mcp/client` with secret key and PasskeyKit signing.

**Contract:** Token Factory · `CAHLJEQUCNTV7JPAPCMLCBIHOX7FFB57DUARJ6XGTW27FPCVKKY7JM2A` · Stellar testnet

---

## Setup

```bash
cd examples/node-app
pnpm install
cp .env.example .env   # fill in MCP_URL at minimum
pnpm run smoke
```

Start the server first:
```bash
USE_HTTP=true PORT=3001 node dist/index.js
```

The smoke test runs 9 steps — read queries, `secretKeySigner` writes, and `passkeyKitSigner`.
Steps that need credentials not set in `.env` are gracefully skipped.

| Variable | Required for |
|---|---|
| `MCP_URL` | everything |
| `TEST_SECRET_KEY` + `TEST_ADMIN_ADDRESS` | steps 6–8 (secretKey path) |
| `WALLET_CONTRACT_ID` + `FEE_PAYER_SECRET` | step 9 (passkey path) |

---

## PasskeyKit wallet setup (step 9)

One-time setup to deploy a smart wallet contract for the passkey signing test:

**1. Upload the wallet WASM**
```bash
stellar contract upload \
  --wasm path/to/smart_wallet.wasm \
  --source me \
  --network testnet
```

**2. Deploy the wallet contract**
```bash
WASM_HASH=<hash> DEPLOYER_SECRET=$(stellar keys show me) \
pnpm run deploy-passkey-wallet
```

The script prints the values to add to `.env` (node-app) and the server's `.env`,
then restart the server with the new wallet env vars.

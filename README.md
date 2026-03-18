# stellar-mcp

A Model Context Protocol (MCP) ecosystem for the Stellar blockchain. Generate production-ready MCP servers from any deployed Soroban contract, connect them to AI agents, and interact via a type-safe SDK or ready-to-deploy templates.

---

## What's in this repo

| Component | Path | Description |
|---|---|---|
| **MCP Generator** | `stellar-mcp-generator/` | Rust CLI plugin — generates TypeScript or Python MCP servers from any deployed Soroban contract |
| **SDK** | `packages/client/` | `@stellar-mcp/client` — type-safe programmatic client for generated MCP servers |
| **Telegram Bot template** | `templates/telegram-bot/` | Vercel-deployable Telegram bot powered by an AI agent + MCP server |
| **Smart Wallet template** | `templates/smart-wallet/` | Next.js 15 app with PasskeyKit smart wallet and MCP tool browser |
| **CLI Agent template** | `templates/cli-agent/` | Terminal agent — list tools, call them interactively or one-shot from any shell |
| **Standalone MCP server** | `src/` | Original stdio MCP server for Claude Desktop (account management, Soroban transactions) |
| **Policy CLI** | `stellar-policy-cli/` | Rust CLI — generates Soroban policy contracts to restrict what a signing key can authorize |

---

## Quick Start

### 1. Generate an MCP server from a contract

```bash
# Install the Stellar CLI plugin
cargo install --path stellar-mcp-generator

# Generate a TypeScript MCP server
stellar mcp generate \
  --contract-id CAHLJEQUCNTV7JPAPCMLCBIHOX7FFB57DUARJ6XGTW27FPCVKKY7JM2A \
  --rpc-url https://soroban-testnet.stellar.org \
  --network-passphrase "Test SDF Network ; September 2015" \
  --output ./my-mcp-server

cd my-mcp-server && npm install && npm run build
```

### 2. Run the generated server

```bash
# stdio mode (Claude Desktop)
node dist/index.js

# HTTP mode (web frontends, CLI agent, Telegram bot)
USE_HTTP=true PORT=3000 node dist/index.js
```

### 3. Connect via SDK

```bash
npm install @stellar-mcp/client
```

```ts
import { MCPClient, secretKeySigner } from '@stellar-mcp/client';

const client = new MCPClient({
  url: 'http://localhost:3000/mcp',
  networkPassphrase: 'Test SDF Network ; September 2015',
  rpcUrl: 'https://soroban-testnet.stellar.org',
});

const tools = await client.listTools();
const { data } = await client.call('get-admin');
const { xdr } = await client.call('deploy-token', { deployer: 'G...' });
const result = await client.signAndSubmit(xdr!, {
  signer: secretKeySigner(process.env.SECRET_KEY!),
});
client.close();
```

---

## Templates

Each template is a standalone project you copy, configure with a `.env`, and deploy.

### Telegram Bot (`templates/telegram-bot/`)

An AI agent (Claude or GPT-4) that connects to your MCP server and handles Telegram messages. Deploys to Vercel in one command.

```bash
cd templates/telegram-bot
cp .env.example .env   # set MCP_SERVER_URL, BOT_TOKEN, ANTHROPIC_API_KEY
vercel deploy
```

### Smart Wallet (`templates/smart-wallet/`)

Next.js 15 app with a PasskeyKit smart wallet. Users authenticate with a passkey (no seed phrase) and interact with MCP tools through a chat-style UI.

```bash
cd templates/smart-wallet
cp .env.example .env   # set MCP_SERVER_URL, NEXT_PUBLIC_WALLET_WASM_HASH
pnpm install && pnpm dev
vercel deploy          # vercel.json included
```

### CLI Agent (`templates/cli-agent/`)

Terminal agent for any MCP server. Guided wizard, REPL loop, JSON output, and inline one-shot mode.

```bash
cd templates/cli-agent
cp .env.example .env   # set MCP_SERVER_URL
pnpm install && pnpm build && npm install -g .

stellar-mcp-cli                        # guided wizard
stellar-mcp-cli list                   # list tools
stellar-mcp-cli call get-admin         # call a tool
stellar-mcp-cli call deploy-token \
  --args '{"deployer":"G...","config":{...}}'
```

---

## Production Deployment

Generated servers support Docker out of the box.

```bash
# TypeScript server
docker build -t my-mcp-server .
docker run -p 3000:3000 \
  -e CONTRACT_ID=CC... \
  -e SIGNER_SECRET=S... \
  my-mcp-server

# Vercel (serverless)
vercel deploy   # vercel.json is included in generated output
```

Environment variables supported by all generated servers:

| Variable | Default | Description |
|---|---|---|
| `USE_HTTP` | `false` | Set `true` to enable HTTP mode (required for all templates) |
| `PORT` | `3000` | HTTP port |
| `CORS_ORIGINS` | `*` | Comma-separated allowed origins (set explicitly in production) |
| `RATE_LIMIT` | `100` | Max requests per IP per minute |
| `SIGNER_SECRET` | — | Stellar secret key for signing write operations |
| `CONTRACT_ID` | baked in | Override the contract ID at runtime |

See [`docs/security.md`](../docs/security.md) for hardening guidance.

---

## Standalone MCP Server (Claude Desktop)

The original `src/` server connects Claude Desktop directly to Stellar.

```json
{
  "servers": {
    "stellar-mcp": {
      "command": "node",
      "args": ["/path/to/stellar-mcp/build/mcp-server.js"],
      "env": {
        "RPC_URL": "https://soroban-testnet.stellar.org",
        "NETWORK_PASSPHRASE": "Test SDF Network ; September 2015"
      }
    }
  }
}
```

Tools: `create-account`, `fund-account`, `get-account`, `get-transactions`, `sign-and-submit-transaction`.

---

## Contributing

Pull requests welcome. Please open an issue first for large changes.

## License

ISC

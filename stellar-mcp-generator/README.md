# Stellar MCP Generator

[![Apache 2.0 licensed](https://img.shields.io/badge/license-apache%202.0-blue.svg)](LICENSE)

A [Stellar CLI plugin](https://developers.stellar.org/docs/tools/cli/plugins) that generates MCP (Model Context Protocol) servers from deployed Soroban smart contracts, enabling AI agents to interact with your contracts through standardized tools.

---

## Overview

**Stellar MCP Generator** reads contract specifications from deployed Soroban contracts and generates complete MCP servers in **TypeScript** or **Python**. This allows AI assistants like Claude to:

- Call any contract function as an MCP tool
- Understand contract types and parameters
- Build and simulate transactions
- Sign and submit transactions via OpenZeppelin Relayer or PasskeyKit

---

## Prerequisites

Before you begin, make sure you have the following installed:

### Required for Installation

| Tool                                                    | Description                | Install Link                                                        |
| ------------------------------------------------------- | -------------------------- | ------------------------------------------------------------------- |
| [Rust & Cargo](https://www.rust-lang.org/tools/install) | For installing the plugin  | `curl https://sh.rustup.rs -sSf \| sh`                              |
| [Stellar CLI](https://github.com/stellar/stellar-cli)   | Required for plugin system | [Installation Guide](https://developers.stellar.org/docs/tools/cli) |

### For TypeScript MCP Servers

| Tool                           | Description                     | Version | Install Link                |
| ------------------------------ | ------------------------------- | ------- | --------------------------- |
| [Node.js](https://nodejs.org/) | For running TypeScript servers  | **18+** | Download from official site |
| [pnpm](https://pnpm.io/)       | Fast, efficient package manager | Latest  | `npm install -g pnpm`       |

> **Important**: Node.js 18 or higher is required. Verify with `node --version`.

### For Python MCP Servers

| Tool                                                                            | Description                                   | Version   | Install Link                |
| ------------------------------------------------------------------------------- | --------------------------------------------- | --------- | --------------------------- |
| [Python](https://www.python.org/)                                               | For running Python servers                    | **3.10+** | Download from official site |
| [uv](https://docs.astral.sh/uv/)                                                | Fast Python package manager (recommended)     | Latest    | `pip install uv`            |
| [stellar-contract-bindings](https://pypi.org/project/stellar-contract-bindings/) | For generating type-safe Python bindings (auto-called by generator) | **0.5.0+** | `pip install stellar-contract-bindings` |

> **Important**:
> - Python 3.10 or higher is required. Verify with `python --version`.
> - `stellar-contract-bindings` is required for Python generation. Install with `pip install stellar-contract-bindings` or `uv pip install stellar-contract-bindings`.

---

## Installation

### Install from source (current method)

```bash
git clone https://github.com/stellar/stellar-mcp-generator
cd stellar-mcp-generator
cargo install --path .
```

### Install from crates.io (coming soon)

```bash
# Not yet published - use source installation above
cargo install stellar-mcp-generator
```

> Once published, we recommend using [cargo-binstall](https://github.com/cargo-bins/cargo-binstall) for faster installation of pre-compiled binaries.

### Verify Installation

```bash
stellar plugins --list
```

You should see output similar to:

```
Installed Plugins:
    mcp
```

The `mcp` plugin should be listed among your installed plugins.

---

## Quickstart

### TypeScript MCP Server

```bash
# 1. Generate the server (default is TypeScript)
stellar mcp generate \
  --contract-id <Contract ID> \
  --network testnet \
  --output ./my-token-mcp \
  --name my-token

# 2. Install dependencies
cd my-token-mcp
pnpm install

# 3. Configure environment
cp .env.example .env
# Edit .env with your credentials (RELAYER_API_KEY, etc.)

# 4. Build and run
pnpm run build
pnpm start
```

### Python MCP Server

```bash
# 1. Generate the server with --lang python (bindings auto-generated)
stellar mcp generate \
  --contract-id <Contract ID> \
  --network testnet \
  --lang python \
  --output ./my-token-mcp \
  --name my-token

# 2. Install dependencies
cd my-token-mcp
uv sync

# 3. Configure environment
cp .env.example .env
# Edit .env with your contract details

# 4. Run the server
uv run mcp install server.py
```

> **Note**: Python bindings are automatically generated using `stellar-contract-bindings`. If the package is not installed, the generator will show installation instructions.

---

## Connect to Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "my-token": {
      "command": "node",
      "args": ["/absolute/path/to/my-token-mcp/dist/index.js"],
      "env": {
        "CONTRACT_ID": "YOUR_CONTRACT_ID",
        "RPC_URL": "https://soroban-testnet.stellar.org",
        "NETWORK_PASSPHRASE": "Test SDF Network ; September 2015"
      }
    }
  }
}
```

> See the [Claude Desktop Configuration](#claude-desktop-configuration) section below for detailed setup options including PasskeyKit support.

---

## CLI Reference

### `stellar mcp generate`

Generate an MCP server from a deployed Soroban contract.

```bash
stellar mcp generate [OPTIONS] --contract-id <CONTRACT_ID>
```

#### Options

| Flag                   | Short | Description                                         | Default                             |
| ---------------------- | ----- | --------------------------------------------------- | ----------------------------------- |
| `--contract-id`        | `-c`  | Contract ID to generate server for                  | **Required**                        |
| `--lang`               | `-l`  | Language: `typescript` or `python`                  | `typescript`                        |
| `--network`            | `-n`  | Network: `testnet`, `mainnet`, `futurenet`, `local` | `testnet`                           |
| `--output`             | `-o`  | Output directory for generated server               | `./mcp-server`                      |
| `--name`               |       | Contract name for tool naming                       | From metadata or contract ID prefix |
| `--server-name`        |       | Server name for MCP registration                    | `soroban-contract`                  |
| `--rpc-url`            |       | Custom RPC URL (overrides network)                  | Network default                     |
| `--network-passphrase` |       | Network passphrase (required with custom RPC)       | Network default                     |
| `--with-frontend`      |       | Generate AI-powered React frontend                  | `false`                             |
| `--force`              |       | Overwrite existing output directory                 | `false`                             |
| `--verbose`            | `-v`  | Enable verbose debug output                         | `false`                             |

**Notes**:
- PasskeyKit integration is included by default in TypeScript servers
- Python servers use FastMCP framework and require `stellar-contract-bindings`
- `--with-frontend` generates an AI-powered React frontend (TypeScript only for now)

#### Examples

```bash
# Basic TypeScript generation (default)
stellar mcp generate -c CABC123... -n testnet -o ./my-mcp

# Python server
stellar mcp generate -c CABC123... -l python -o ./my-python-mcp

# With custom name
stellar mcp generate -c CABC123... --name nft-factory -o ./nft-mcp

# Mainnet with custom RPC
stellar mcp generate -c CABC123... \
  --rpc-url https://my-rpc.example.com \
  --network-passphrase "Public Global Stellar Network ; September 2015" \
  -o ./prod-mcp

# Force overwrite existing directory
stellar mcp generate -c CABC123... --force -o ./my-mcp

# With AI-powered React frontend
stellar mcp generate -c CABC123... --with-frontend -o ./my-mcp
```

### `stellar mcp validate`

Validate a generated MCP server.

```bash
stellar mcp validate <PATH> [OPTIONS]
```

#### Options

| Flag          | Description                  | Default |
| ------------- | ---------------------------- | ------- |
| `--typecheck` | Run TypeScript type checking | `false` |

#### Example

```bash
stellar mcp validate ./my-token-mcp --typecheck
```

---

## Generated Output

After running `stellar mcp generate`, your output directory will contain:

```
my-token-mcp/
├── src/
│   ├── index.ts              # MCP server entry point (stdio + HTTP, rate limiting)
│   ├── tools/
│   │   └── my-token.ts       # Contract function handlers
│   ├── schemas/
│   │   └── my-token.ts       # Zod validation schemas
│   ├── bindings/             # Auto-generated Stellar TypeScript bindings
│   └── lib/
│       ├── transaction.ts    # Transaction parsing utilities
│       ├── passkey.ts        # PasskeyKit integration
│       ├── utils.ts          # Signing utilities
│       └── submit.ts         # Transaction submission utilities
├── deploy-wallet.ts          # PasskeyKit wallet deployment script
├── Dockerfile                # Production Docker image (multi-stage)
├── vercel.json               # Vercel serverless deployment config
├── package.json              # Dependencies and scripts (includes pnpm deploy-passkey)
├── tsconfig.json             # TypeScript configuration
├── .env.example              # Environment variable template
└── README.md                 # Usage documentation
```

---

## Features

### AI-Powered Frontend (New!)

Generate a complete React frontend with natural language chat interface:

```bash
stellar mcp generate -c CABC123... --with-frontend
```

**What You Get:**
- 🤖 **AI Chat Interface**: Talk to your smart contract in natural language
- 🔐 **Dual Authentication**: Wallet mode (Freighter) or Secret Key mode
- ⚡ **Real-time Streaming**: Live AI responses with tool execution visibility
- 🌐 **Multi-Provider**: OpenAI (GPT-4) or Anthropic (Claude)
- 📱 **Modern Stack**: React 19, TypeScript, Vite 7, Tailwind CSS 4

**Architecture:**
```
User → React Frontend → Express API → OpenAI/Anthropic → MCP Server → Stellar
```

**Example Interactions:**
- "What's the current balance?"
- "Transfer 100 tokens to GABC..."
- "Check allowance and increase if needed"

**Currently:** TypeScript MCP servers only. Python support coming soon!

### Automatic Tool Generation

Every public function in your contract becomes an MCP tool that AI agents can call.

### Contract Name from Metadata

If your contract includes a `name` key in its metadata, the generator will use it automatically:

```rust
#[contractmeta(key = "name", val = "my-token")]
```

Or when building:

```bash
stellar contract build --meta name=my-token
```

### Type-Safe Validation

All inputs are validated using Zod schemas generated from the contract spec.

### OpenZeppelin Relayer Integration

Submit transactions with fee sponsorship via the [OpenZeppelin Relayer](https://docs.openzeppelin.com/relayer/1.4.x/stellar).

### PasskeyKit Support

The generator includes full PasskeyKit integration for smart wallet functionality:

**What's Included:**
- Complete PasskeyKit client implementation
- Wallet deployment script (`deploy-wallet.ts`)
- Two-phase transaction signing (auth entries + envelope)
- Automatic signer configuration

**Deploying a PasskeyKit Wallet:**

1. Set environment variables in `.env`:
   ```bash
   RPC_URL=https://soroban-testnet.stellar.org
   NETWORK_PASSPHRASE=Test SDF Network ; September 2015
   SIGNER_SECRET=S...  # Your deployer keypair secret
   ```

2. Run the deployment script:
   ```bash
   pnpm deploy-passkey <WALLET_WASM_HASH>
   ```

3. Copy the deployed wallet contract ID to use in Claude Desktop configuration (see below).

**Using PasskeyKit with Claude Desktop:**

When configuring the MCP server with PasskeyKit support, you'll need to provide the `WALLET_WASM_HASH` in the environment variables. See the Configuration section below for details.

### HTTP Transport

Generated servers support dual transport modes:

- **stdio** (default) — for Claude Desktop and other MCP clients that communicate over stdin/stdout
- **HTTP** — for web frontends, the CLI agent template, Telegram bot, and production deployments

```bash
# stdio mode (Claude Desktop)
node dist/index.js

# HTTP mode
USE_HTTP=true PORT=3000 node dist/index.js
```

When HTTP mode is enabled, the server exposes:
- `POST /mcp` — MCP protocol endpoint
- `GET /health` — health check (not rate limited)
- CORS headers, security headers, and request body size limits (1 MB)

### Rate Limiting

HTTP mode includes a built-in sliding-window rate limiter per client IP:

| Environment Variable | Description | Default |
|---|---|---|
| `RATE_LIMIT` | Max requests per minute per IP | `100` |

When the limit is exceeded the server responds with HTTP 429 and includes `Retry-After` and `X-RateLimit-Limit` headers. The `/health` endpoint is exempt.

For multi-instance deployments (e.g., behind a load balancer), swap the in-memory limiter for Redis:

```ts
import { RateLimiterRedis } from 'rate-limiter-flexible';
```

The `rate-limiter-flexible` package is already included in the generated `package.json`.

### Production Deployment

Generated servers include deployment configurations out of the box.

#### Docker

Both TypeScript and Python servers include a `Dockerfile`:

```bash
# TypeScript server (multi-stage Node 20 Alpine build)
cd my-token-mcp
docker build -t my-mcp-server .
docker run -p 3000:3000 \
  -e CONTRACT_ID=CC... \
  -e SIGNER_SECRET=S... \
  my-mcp-server
```

```bash
# Python server (Python 3.11 slim)
cd my-python-mcp
docker build -t my-mcp-server .
docker run -p 3000:3000 \
  -e CONTRACT_ID=CC... \
  -e RPC_URL=https://soroban-testnet.stellar.org \
  my-mcp-server
```

Both images run as non-root, include a health check on `/health`, and default to HTTP mode (`USE_HTTP=true PORT=3000`).

#### Vercel (serverless)

TypeScript servers include a `vercel.json` for one-command deployment:

```bash
cd my-token-mcp
pnpm run build
vercel deploy
```

The MCP endpoint is available at `/mcp` on your Vercel deployment URL.

---

## Supported Networks

| Network     | RPC URL                               | Passphrase                                       |
| ----------- | ------------------------------------- | ------------------------------------------------ |
| `testnet`   | `https://soroban-testnet.stellar.org` | `Test SDF Network ; September 2015`              |
| `mainnet`   | `https://soroban.stellar.org`         | `Public Global Stellar Network ; September 2015` |
| `futurenet` | `https://rpc-futurenet.stellar.org`   | `Test SDF Future Network ; October 2022`         |
| `local`     | `http://localhost:8000/soroban/rpc`   | `Standalone Network ; February 2017`             |

---

## Claude Desktop Configuration

After generating and building your MCP server, configure Claude Desktop by adding to:
`~/Library/Application Support/Claude/claude_desktop_config.json` (macOS)
`%APPDATA%/Claude/claude_desktop_config.json` (Windows)

### Basic Configuration (Standard Keypair Signing)

For standard contract interaction with keypair-based signing:

```json
{
  "mcpServers": {
    "my-token": {
      "command": "node",
      "args": ["/absolute/path/to/my-token-mcp/dist/index.js"],
      "env": {
        "CONTRACT_ID": "CBQHNAXSI55GX2GN6D67GK7BHVPSLJUGZQEU7WJ5LKR5PNUCGLIMAO4K",
        "RPC_URL": "https://soroban-testnet.stellar.org",
        "NETWORK_PASSPHRASE": "Test SDF Network ; September 2015"
      }
    }
  }
}
```

**Required Environment Variables:**
- `CONTRACT_ID` - Your deployed contract address
- `RPC_URL` - Stellar RPC endpoint URL
- `NETWORK_PASSPHRASE` - Network passphrase for the target network

### With PasskeyKit Support

For smart wallet functionality with passkey authentication:

```json
{
  "mcpServers": {
    "my-token": {
      "command": "node",
      "args": ["/absolute/path/to/my-token-mcp/dist/index.js"],
      "env": {
        "CONTRACT_ID": "CBQHNAXSI55GX2GN6D67GK7BHVPSLJUGZQEU7WJ5LKR5PNUCGLIMAO4K",
        "RPC_URL": "https://soroban-testnet.stellar.org",
        "NETWORK_PASSPHRASE": "Test SDF Network ; September 2015",
        "WALLET_WASM_HASH": "your_wallet_wasm_hash_here"
      }
    }
  }
}
```

**Additional Environment Variable:**
- `WALLET_WASM_HASH` - WASM hash of the deployed PasskeyKit wallet contract (required for passkey signing)

> **Note**: The WASM hash is needed for deploying new wallet instances and is different from the wallet contract ID. You can obtain it when deploying a wallet contract or from the PasskeyKit documentation.

---

## Development

### Build from Source

```bash
git clone https://github.com/stellar/stellar-mcp-generator
cd stellar-mcp-generator
cargo build --release
```

### Run Tests

```bash
cargo test
```

### Debug Mode

```bash
RUST_LOG=debug cargo run -- generate -c CABC123... -n testnet -v
```

### Project Structure

```
stellar-mcp-generator/
├── src/
│   ├── main.rs                  # CLI entry point
│   ├── lib.rs                   # Core library and CLI definitions
│   ├── commands/
│   │   ├── generate.rs          # Generate command implementation
│   │   └── validate.rs          # Validate command implementation
│   ├── spec/
│   │   ├── fetcher.rs           # Contract spec fetching from RPC
│   │   ├── parser.rs            # WASM spec parsing (soroban-spec-tools)
│   │   └── types.rs             # Internal type definitions
│   ├── generator/
│   │   ├── mcp_generator.rs     # TypeScript code generation
│   │   ├── python_generator.rs  # Python code generation
│   │   ├── frontend_generator.rs# React frontend generation
│   │   ├── pydantic_schemas.rs  # Python Pydantic schema generation
│   │   ├── template_data.rs     # Template data structures
│   │   └── templates.rs         # Handlebars template registration
│   └── wizard/                  # Interactive setup wizard
├── templates/                   # Handlebars templates (TypeScript)
│   ├── index.ts.hbs             # MCP server entry point
│   ├── tools.ts.hbs             # Tool handlers
│   ├── schemas.ts.hbs           # Zod schemas
│   ├── Dockerfile.hbs           # Docker image (multi-stage)
│   ├── vercel.json.hbs          # Vercel deployment config
│   └── python/                  # Python templates
│       ├── server.py.hbs        # FastMCP server
│       ├── Dockerfile.hbs       # Python Docker image
│       └── ...
├── tests/                       # Integration tests
├── Cargo.toml
└── README.md
```

---

## Troubleshooting

### Plugin not found

If `stellar mcp` doesn't work after installation:

1. Ensure the binary is in your PATH:

   ```bash
   which stellar-mcp
   ```

2. Verify the binary is executable:

   ```bash
   chmod +x $(which stellar-mcp)
   ```

3. Restart your terminal or reload shell config.

### Contract spec not found

If you get "Failed to fetch contract spec":

1. Verify the contract ID is correct
2. Ensure the contract is deployed on the specified network
3. Check your network connection to the RPC endpoint

### TypeScript build errors

If the generated server fails to compile:

1. **Verify Node.js version**:
   ```bash
   node --version  # Must be 18.0.0 or higher
   ```
   If you're running an older version, upgrade Node.js before proceeding.

2. Clean install dependencies:
   ```bash
   rm -rf node_modules pnpm-lock.yaml
   pnpm install
   ```

3. Run validation:
   ```bash
   stellar mcp validate ./my-token-mcp --typecheck
   ```

### PasskeyKit deployment issues

If `pnpm deploy-passkey` fails:

1. Ensure all required environment variables are set in `.env`:
   - `RPC_URL`
   - `NETWORK_PASSPHRASE`
   - `SIGNER_SECRET`

2. Verify the WASM hash is correct (56-character hex string)

3. Check that your signer account has enough XLM balance for deployment

---

## Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.

---

## License

This project is licensed under the Apache-2.0 License - see the [LICENSE](LICENSE) file for details.

---

## Need Help?

- Open an issue on GitHub
- Check [Stellar Developer Docs](https://developers.stellar.org/)
- Join the [Stellar Discord](https://discord.gg/stellar)

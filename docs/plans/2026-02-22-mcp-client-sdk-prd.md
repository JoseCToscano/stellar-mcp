# Product Requirements Document: Stellar MCP Client SDK & Templates

**Version:** 1.0
**Date:** 2026-02-22
**Author:** Jose Toscano
**Status:** Approved for Development

---

## Executive Summary

This document defines the requirements for building a TypeScript SDK and developer templates that enable applications to interact with Stellar MCP (Model Context Protocol) servers. The SDK provides a simple API for discovering contract tools, executing transactions, and signing with multiple wallet types. Three production-ready templates demonstrate real-world usage patterns.

---

## Objectives

1. **SDK**: Publish `@stellar-mcp/client` to npm with a minimal, developer-friendly API
2. **Templates**: Provide 3 copy-paste starter projects (Telegram Bot, Smart Wallet UI, CLI Agent)
3. **Infrastructure**: Add production-ready features to generated MCP servers
4. **Documentation**: Expand mcpdocs.vercel.app with SDK reference and template guides
5. **Demo**: Produce a video demonstrating the complete flow from contract to working application

---

## Scope

### In Scope

- TypeScript SDK for MCP server interaction
- Two wallet adapters (Freighter, PasskeyKit)
- Three starter templates with Vercel deployment
- Minimal production infrastructure (health checks, rate limiting, Docker)
- 7 documentation pages
- One end-to-end demo video

### Out of Scope

- Python SDK (future work)
- Mobile SDKs
- Complex observability (OpenTelemetry)
- Multi-cloud deployment guides
- Video tutorials or interactive playgrounds

---

## Technical Requirements

### 1. MCP Client SDK

**Package:** `@stellar-mcp/client`
**Location:** `stellar-mcp/packages/client/`

#### 1.1 Core API

```typescript
import { MCPClient, freighterSigner, passkeyKitSigner } from '@stellar-mcp/client';

// Initialize client
const client = new MCPClient({
  transport: 'http',
  url: 'http://localhost:3000',
});

// Discover available tools
const tools = await client.listTools();
// Returns: [{ name: 'transfer', description: '...', inputSchema: {...} }, ...]

// Call a tool (returns unsigned XDR)
const { xdr, simulation } = await client.call('transfer', {
  from: 'GABC...',
  to: 'GDEF...',
  amount: '1000000',
});

// Sign and submit transaction
const result = await client.signAndSubmit(xdr, {
  signer: freighterSigner(),
});
// Returns: { hash: '...', status: 'SUCCESS', result: {...} }
```

#### 1.2 Module Structure

| File | Exports | Responsibility |
|------|---------|----------------|
| `client.ts` | `MCPClient` | Connection, tool discovery, tool calling |
| `transaction.ts` | `simulate`, `signAndSubmit`, `waitForConfirmation` | XDR lifecycle |
| `signers.ts` | `freighterSigner`, `passkeyKitSigner` | Wallet adapters |
| `types.ts` | Type definitions | TypeScript interfaces |
| `index.ts` | Public API | Re-exports public surface |

#### 1.3 MCPClient Class

```typescript
interface MCPClientOptions {
  transport: 'http';           // HTTP/SSE transport (stdio not required)
  url: string;                 // MCP server URL
  timeout?: number;            // Request timeout (default: 30000ms)
}

class MCPClient {
  constructor(options: MCPClientOptions);

  // List available tools from MCP server
  listTools(): Promise<Tool[]>;

  // Call a tool by name with arguments
  call(toolName: string, args: Record<string, unknown>): Promise<CallResult>;

  // Sign and submit a transaction
  signAndSubmit(xdr: string, options: SignOptions): Promise<SubmitResult>;

  // Close connection
  close(): void;
}
```

#### 1.4 Wallet Adapters

**Freighter Signer** (browser extension):
```typescript
function freighterSigner(): Signer;
```

**PasskeyKit Signer** (smart wallets):
```typescript
interface PasskeyKitOptions {
  walletContractId: string;
  rpcUrl: string;
  networkPassphrase: string;
}

function passkeyKitSigner(options: PasskeyKitOptions): Signer;
```

#### 1.5 Package Requirements

| Requirement | Specification |
|-------------|---------------|
| Package name | `@stellar-mcp/client` |
| TypeScript | Strict mode, full type definitions |
| Target | ES2020, CommonJS + ESM dual export |
| Node.js | 18+ |
| Browser | Modern browsers (Chrome, Firefox, Safari, Edge) |
| Dependencies | Minimal (stellar-sdk, @stellar/freighter-api, passkey-kit) |
| Bundle size | <50KB minified (tree-shakeable) |

#### 1.6 Acceptance Criteria

- [ ] `npm install @stellar-mcp/client` installs successfully
- [ ] Can connect to TypeScript MCP server via HTTP
- [ ] Can connect to Python MCP server via HTTP
- [ ] `listTools()` returns tool schemas correctly
- [ ] `call()` returns unsigned XDR and simulation result
- [ ] `signAndSubmit()` works with Freighter signer
- [ ] `signAndSubmit()` works with PasskeyKit signer
- [ ] Works in Node.js 18+
- [ ] Works in browser (tested with Vite and Next.js)
- [ ] All tests passing
- [ ] README with quick start guide
- [ ] TSDoc comments on all public APIs

---

### 2. Developer Templates

**Location:** `stellar-mcp/templates/`

Each template is a standalone project that users copy and configure. Templates consume the SDK as an npm dependency, not a workspace link.

#### 2.1 Telegram Bot Template

**Location:** `templates/telegram-bot/`

**Stack:**
- Next.js 14 (App Router)
- grammy (Telegram Bot API)
- `@stellar-mcp/client`
- Vercel deployment (webhook-based)

**Structure:**
```
telegram-bot/
├── src/
│   ├── app/
│   │   └── api/
│   │       └── webhook/
│   │           └── route.ts    # Telegram webhook handler
│   └── lib/
│       └── mcp.ts              # MCP client wrapper
├── .env.example
├── package.json
├── vercel.json
└── README.md
```

**Commands:**
| Command | Description |
|---------|-------------|
| `/start` | Welcome message with available commands |
| `/tools` | List available contract tools |
| `/call <tool> <args>` | Execute a contract tool |
| `/balance <address>` | Query balance (if applicable) |

**Environment Variables:**
```
TELEGRAM_BOT_TOKEN=
MCP_SERVER_URL=
SIGNER_SECRET=
```

**Acceptance Criteria:**
- [ ] Clone, `pnpm install`, configure `.env`, `pnpm dev` works
- [ ] Bot responds to `/start` command
- [ ] Bot can list tools from MCP server
- [ ] Bot can execute a contract call and return result
- [ ] Deploys to Vercel with `vercel deploy`
- [ ] README explains setup in <5 minutes

---

#### 2.2 Smart Wallet UI Template

**Location:** `templates/smart-wallet/`

**Stack:**
- Next.js 14 (App Router)
- Tailwind CSS
- PasskeyKit
- `@stellar-mcp/client`
- Vercel deployment

**Structure:**
```
smart-wallet/
├── src/
│   ├── app/
│   │   ├── page.tsx            # Main page
│   │   └── layout.tsx          # Layout with providers
│   ├── components/
│   │   ├── WalletConnect.tsx   # Passkey wallet creation/connection
│   │   ├── Chat.tsx            # Chat interface for tool calls
│   │   ├── TransactionPreview.tsx
│   │   └── TransactionResult.tsx
│   └── lib/
│       ├── mcp.ts              # MCP client singleton
│       └── passkey.ts          # PasskeyKit wrapper
├── .env.example
├── package.json
├── tailwind.config.js
├── vercel.json
└── README.md
```

**Features:**
| Feature | Description |
|---------|-------------|
| Wallet Creation | Create new smart wallet with passkey |
| Wallet Connection | Connect existing wallet |
| Tool Discovery | Show available contract tools |
| Chat Interface | Natural language-ish tool calling |
| Transaction Preview | Show simulation before signing |
| Transaction Result | Display success/failure with explorer link |

**Environment Variables:**
```
NEXT_PUBLIC_MCP_SERVER_URL=
NEXT_PUBLIC_NETWORK_PASSPHRASE=
NEXT_PUBLIC_RPC_URL=
WALLET_WASM_HASH=
```

**Acceptance Criteria:**
- [ ] Clone, `pnpm install`, configure `.env`, `pnpm dev` works
- [ ] Can create new passkey wallet
- [ ] Can connect existing wallet
- [ ] Chat shows available tools
- [ ] Can execute transaction through chat
- [ ] Transaction preview shows before signing
- [ ] Success shows transaction hash with explorer link
- [ ] Deploys to Vercel with `vercel deploy`
- [ ] README explains setup in <5 minutes

---

#### 2.3 CLI Agent Template

**Location:** `templates/cli-agent/`

**Stack:**
- Node.js 18+
- commander (CLI framework)
- `@stellar-mcp/client`

**Structure:**
```
cli-agent/
├── src/
│   └── index.ts                # CLI entry point
├── .env.example
├── package.json
├── tsconfig.json
└── README.md
```

**Commands:**
```bash
# List available tools
stellar-agent list

# Call a tool
stellar-agent call transfer --from GABC... --to GDEF... --amount 1000000

# Call with JSON args
stellar-agent call deploy_token --args '{"name":"MyToken","symbol":"MTK"}'

# JSON output for piping
stellar-agent call get_balance --address GABC... --json
```

**Environment Variables:**
```
MCP_SERVER_URL=
SIGNER_SECRET=
```

**Acceptance Criteria:**
- [ ] Clone, `pnpm install`, configure `.env` works
- [ ] `stellar-agent list` shows tools from MCP server
- [ ] `stellar-agent call <tool>` executes and returns result
- [ ] `--json` flag outputs valid JSON
- [ ] `--help` shows usage information
- [ ] README explains setup in <5 minutes

---

### 3. Production Infrastructure

**Location:** Updates to `stellar-mcp-generator/`

#### 3.1 Generated Server Enhancements

| Feature | Implementation |
|---------|----------------|
| Health endpoint | `GET /health` returns `{ status: 'ok', timestamp: '...' }` |
| Rate limiting | 100 requests/minute per IP (configurable via env) |
| CORS | Configurable origins via `CORS_ORIGINS` env var |
| Graceful shutdown | Handle SIGTERM, close connections |

#### 3.2 Deployment Files

**Dockerfile (TypeScript):**
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile
COPY . .
RUN pnpm build
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

**Dockerfile (Python):**
```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY pyproject.toml ./
RUN pip install uv && uv sync
COPY . .
EXPOSE 3000
CMD ["uv", "run", "python", "-m", "src.server"]
```

**vercel.json:**
```json
{
  "functions": {
    "api/**/*.ts": {
      "memory": 1024,
      "maxDuration": 30
    }
  }
}
```

#### 3.3 Security Guide

Create `docs/security.md` covering:
- Environment variable management (never commit secrets)
- Rate limiting configuration
- CORS configuration for production
- HTTPS requirements
- Input validation (handled by MCP schemas)

#### 3.4 Acceptance Criteria

- [ ] Generated TypeScript servers include `/health` endpoint
- [ ] Generated Python servers include `/health` endpoint
- [ ] Rate limiting works (returns 429 when exceeded)
- [ ] Dockerfile builds and runs for TypeScript
- [ ] Dockerfile builds and runs for Python
- [ ] vercel.json enables deployment to Vercel
- [ ] Security guide document exists

---

### 4. Documentation

**Location:** mcpdocs.vercel.app (existing docs site)

#### 4.1 New Pages

| Path | Title | Content |
|------|-------|---------|
| `/docs/sdk` | MCP Client SDK | Overview, installation, quick start example |
| `/docs/sdk/api-reference` | API Reference | MCPClient methods, signers, types |
| `/docs/templates` | Templates Overview | What templates are available, when to use each |
| `/docs/templates/telegram-bot` | Telegram Bot | Setup, configuration, deployment, customization |
| `/docs/templates/smart-wallet` | Smart Wallet UI | Setup, PasskeyKit config, deployment |
| `/docs/templates/cli-agent` | CLI Agent | Setup, commands, scripting examples |
| `/docs/deployment` | Deployment Guide | Vercel deployment, Docker deployment, env vars |

#### 4.2 Page Requirements

Each page must include:
- Clear title and one-sentence description
- Prerequisites (if any)
- Step-by-step instructions
- Code examples (copyable)
- Troubleshooting section (common issues)

#### 4.3 Acceptance Criteria

- [ ] All 7 pages exist and are accessible
- [ ] SDK API reference documents all public methods
- [ ] Each template has its own setup guide
- [ ] Code examples are correct and tested
- [ ] No broken links

---

### 5. End-to-End Demo Video

**Deliverable:** YouTube video (unlisted is acceptable)

#### 5.1 Demo Flow

| Segment | Duration | Content |
|---------|----------|---------|
| 1. Introduction | 30s | What we're building, toolkit overview |
| 2. Generate MCP Server | 1m | Run `stellar mcp generate` with Token Factory contract |
| 3. Start Server | 30s | `pnpm dev`, show server running |
| 4. SDK Demo | 1.5m | Script using `@stellar-mcp/client`, discover tools, call tool |
| 5. Transaction | 1m | Sign and submit, show confirmation |
| 6. Template Demo | 2m | Smart Wallet UI - create wallet, execute transaction |
| 7. Verification | 30s | Show transaction on Stellar Expert |

**Total Duration:** 6-7 minutes

#### 5.2 Technical Requirements

| Requirement | Specification |
|-------------|---------------|
| Resolution | 1080p minimum |
| Audio | Clear narration, no background noise |
| Captions | On-screen text for key commands |
| Network | Stellar Testnet |
| Contract | Token Factory (CAHLJEQUCNTV7JPAPCMLCBIHOX7FFB57DUARJ6XGTW27FPCVKKY7JM2A) |
| Proof | Transaction hash visible and verifiable on Stellar Expert |

#### 5.3 Acceptance Criteria

- [ ] Video uploaded to YouTube
- [ ] Shows complete flow: contract → MCP server → SDK → template
- [ ] At least one real transaction executed on testnet
- [ ] Transaction hash visible and verifiable
- [ ] Audio is clear and professional
- [ ] Duration is 5-8 minutes

---

## Repository Structure

Final structure after all deliverables:

```
stellar-mcp/
├── stellar-mcp-generator/           # Existing - Rust CLI
├── stellar-policy-cli/              # Existing - Rust CLI
├── packages/
│   └── client/                      # NEW - @stellar-mcp/client
│       ├── src/
│       │   ├── client.ts
│       │   ├── transaction.ts
│       │   ├── signers.ts
│       │   ├── types.ts
│       │   └── index.ts
│       ├── tests/
│       ├── package.json
│       ├── tsconfig.json
│       └── README.md
├── templates/
│   ├── telegram-bot/                # NEW - Telegram bot template
│   ├── smart-wallet/                # NEW - Smart wallet UI template
│   └── cli-agent/                   # NEW - CLI agent template
└── docs/
    └── security.md                  # NEW - Security guide
```

---

## Timeline

**Total Duration:** 4-6 weeks

| Week | Focus | Deliverables |
|------|-------|--------------|
| 1 | SDK Core | MCPClient class, HTTP transport, tool discovery, XDR lifecycle |
| 2 | SDK Complete | Wallet adapters (Freighter, PasskeyKit), tests, npm publish |
| 3 | Templates (Part 1) | Telegram Bot + CLI Agent templates |
| 4 | Templates (Part 2) | Smart Wallet UI template + infrastructure updates |
| 5 | Documentation + Demo | 7 doc pages, end-to-end demo video |
| 6 | Buffer | Bug fixes, polish, final review |

---

## Communication

### Weekly Checkpoints

- Async status update or brief call
- PR reviews within 24-48 hours
- Blockers communicated immediately

### Deliverable Reviews

Each phase reviewed before proceeding:
1. SDK core → Review → SDK complete
2. Templates → Review → Templates complete
3. Docs + Demo → Review → Project complete

---

## Definition of Done

**Individual Deliverable:**
- [ ] All acceptance criteria met
- [ ] Tests passing
- [ ] Documentation written
- [ ] PR approved and merged

**Project Complete:**
- [ ] `@stellar-mcp/client` published to npm
- [ ] All 3 templates working and documented
- [ ] Infrastructure updates merged
- [ ] 7 documentation pages live
- [ ] Demo video uploaded to YouTube
- [ ] Full flow verified: contract → MCP server → SDK → template → confirmed transaction

---

## Appendix A: Environment Variables Reference

### SDK (used by templates)

| Variable | Description | Required |
|----------|-------------|----------|
| `MCP_SERVER_URL` | URL of running MCP server | Yes |
| `SIGNER_SECRET` | Stellar secret key for signing | For bots |
| `NETWORK_PASSPHRASE` | Stellar network passphrase | Yes |
| `RPC_URL` | Soroban RPC endpoint | Yes |

### PasskeyKit (Smart Wallet UI)

| Variable | Description | Required |
|----------|-------------|----------|
| `WALLET_WASM_HASH` | Deployed wallet WASM hash | Yes |
| `WALLET_CONTRACT_ID` | Wallet factory contract | Optional |

### Telegram Bot

| Variable | Description | Required |
|----------|-------------|----------|
| `TELEGRAM_BOT_TOKEN` | Token from @BotFather | Yes |

---

## Appendix B: Test Contract

**Contract ID:** `CAHLJEQUCNTV7JPAPCMLCBIHOX7FFB57DUARJ6XGTW27FPCVKKY7JM2A`
**Network:** Stellar Testnet
**Type:** Token Factory

**Available Functions:**
- `deploy_token(deployer, config)` - Deploy new token
- `get_admin()` - Get admin address
- `get_token_count()` - Get total deployed tokens
- `get_deployed_tokens()` - List all deployed tokens

This contract should be used for all testing and the demo video.

---

## Appendix C: Reference Links

- **Stellar SDK:** https://stellar.github.io/js-stellar-sdk/
- **Soroban Docs:** https://soroban.stellar.org/docs
- **PasskeyKit:** https://github.com/kalepail/passkey-kit
- **MCP Spec:** https://modelcontextprotocol.io/
- **MCP TypeScript SDK:** https://github.com/modelcontextprotocol/typescript-sdk
- **Existing MCP Generators:** https://github.com/JoseCToscano/stellar-mcp
- **Current Documentation:** https://mcpdocs.vercel.app

---

## Appendix D: Reference Implementation - Mastra MCPClient

**Reference:** https://mastra.ai/reference/tools/mcp-client

Mastra's MCPClient is a generic MCP client implementation. While our SDK is simpler and Stellar-specific, the following patterns from Mastra may be useful:

### Useful Patterns to Consider

| Pattern | Mastra Implementation | Our Adaptation |
|---------|----------------------|----------------|
| **Instance ID** | Prevents memory leaks when recreating clients with same config | Consider adding optional `id` param to constructor |
| **Custom fetch** | Allows per-request auth headers and token refresh | Consider adding optional `fetch` override for API key injection |
| **Timeout config** | Global default with per-call override | Already planned |
| **Transport auto-detection** | Detects stdio vs HTTP from config | Not needed (HTTP only) |

### What We're NOT Including (and why)

| Mastra Feature | Why We Skip It |
|----------------|----------------|
| Multi-server connections | One contract = one MCP server |
| Namespaced tools (`server_tool`) | Single server, no conflicts |
| Resources API | Our MCP servers don't expose resources |
| Prompts API | Not needed for contract interaction |
| Elicitation | Over-engineering for our use case |
| OAuth flow | Our servers use simple auth or none |
| Stdio transport | Templates use HTTP only |

### Key Differentiator

Our SDK adds **Stellar-specific capabilities** that Mastra lacks:
- `signAndSubmit()` with XDR lifecycle
- Wallet adapters (Freighter, PasskeyKit)
- Transaction simulation and confirmation polling

---

## Contact

**Jose Toscano**
Email: toscano0210@gmail.com
GitHub: @JoseCToscano

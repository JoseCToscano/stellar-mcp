# Stellar MCP Smart Wallet

A Next.js 14 frontend template for Stellar MCP servers that uses **PasskeyKit** (WebAuthn) for transaction signing. No seed phrases, no browser extensions, no XLM needed — Launchtube sponsors all fees.

## What This Is

- Direct form UI for every tool exposed by your MCP server
- **Read** tools: call → display result inline (no signing)
- **Write** tools: call → XDR preview modal → passkey sign → Launchtube submit → hash shown
- Dark/light mode, animated modals, copy-to-clipboard everywhere

## Quick Start (< 5 minutes)

### 1. Install dependencies

```bash
pnpm install
# or: npm install / yarn install
```

### 2. Configure environment

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```bash
# Your running MCP server
NEXT_PUBLIC_MCP_SERVER_URL=http://localhost:3001/mcp

# Stellar network (testnet shown)
NEXT_PUBLIC_RPC_URL=https://soroban-testnet.stellar.org
NEXT_PUBLIC_NETWORK_PASSPHRASE="Test SDF Network ; September 2015"

# Get the WASM hash from the passkey-kit repo, or deploy your own wallet contract
NEXT_PUBLIC_WALLET_WASM_HASH=<hash>

# Get a Launchtube JWT from https://launchtube.xyz
NEXT_PUBLIC_LAUNCHTUBE_URL=https://launchtube.xyz
NEXT_PUBLIC_LAUNCHTUBE_JWT=<jwt>
```

### 3. Start your MCP server

```bash
# In another terminal, start your generated Stellar MCP server:
cd path/to/your-mcp-server
pnpm dev
# Server runs at http://localhost:3001/mcp by default
```

### 4. Run the wallet

```bash
pnpm dev
# Open http://localhost:3000
```

## First Use

1. Open the app — you'll see the wallet setup screen
2. Click **Create New Wallet**, enter a username
3. Your browser prompts for a biometric credential (Touch ID / Face ID / hardware key)
4. PasskeyKit registers the passkey and deploys a smart wallet contract on Stellar
5. You're in — browse and call tools from the Dashboard

To reconnect on a new device: click **Connect Existing Wallet** and authenticate with your passkey.

## Deploy to Vercel

```bash
vercel deploy
```

Set the same environment variables in your Vercel project settings.

## Architecture

```
src/
├── app/
│   ├── layout.tsx          # Root layout (font, metadata, theme script)
│   ├── page.tsx            # WalletSetup or Dashboard
│   └── globals.css         # Tailwind base + CSS vars
├── components/
│   ├── Header.tsx          # Address pill + disconnect + theme toggle
│   ├── WalletSetup.tsx     # Create / Connect passkey modal
│   ├── ToolBrowser.tsx     # Read | Write tabs + tool card grid
│   ├── ToolForm.tsx        # Auto-generated form per tool
│   ├── TransactionModal.tsx # XDR preview + Confirm button
│   ├── SigningOverlay.tsx  # "Awaiting passkey…" full-screen overlay
│   ├── ResultToast.tsx     # Success/fail notification
│   ├── ReadResultCard.tsx  # Render read results
│   └── XdrViewer.tsx       # Collapsible XDR + copy
├── hooks/
│   ├── useWallet.ts        # keyId/contractId state + create/connect/disconnect
│   ├── useMCP.ts           # Tools list from MCP server
│   └── useTransaction.ts  # Sign → submit state machine
└── lib/
    ├── passkey.ts          # PasskeyKit + PasskeyServer singletons
    ├── mcp.ts              # MCPClient factory
    └── schema.ts           # extractArgs, buildToolArgs, isReadOperation
```

## Transaction Flow (Write Tools)

1. User fills form → clicks Execute
2. `useTransaction.execute()` calls the MCP tool → gets XDR
3. `TransactionModal` shows params + XDR preview
4. User clicks Confirm → `SigningOverlay` appears
5. `account.sign(tx, { keyId })` → browser WebAuthn prompt
6. `server.send(signed)` → Launchtube sponsors and submits
7. `ResultToast` shows tx hash + Stellar Expert link

## Tech Stack

| Concern | Library |
|---|---|
| Framework | Next.js 14 (App Router) |
| Styling | Tailwind CSS v3 |
| Animations | framer-motion |
| Wallet | passkey-kit (WebAuthn) |
| MCP client | @stellar-mcp/client |
| XDR parsing | @stellar/stellar-sdk |
| Fee relay | Launchtube |

## Notes

- Wallet state (`keyId`, `contractId`) is stored in `localStorage` — safe for personal browsers
- The wallet WASM hash must match a deployed contract on your target network
- For mainnet: change `NETWORK_PASSPHRASE` and `RPC_URL` accordingly, and update the explorer link in `ResultToast.tsx`

# Smart Wallet Template

A Next.js app that lets users interact with any Stellar MCP server using a **PasskeyKit smart wallet**. No browser extensions, no private keys, no XLM needed — just biometrics.

## How It Works

1. User creates or connects a passkey wallet (WebAuthn in the browser)
2. The app discovers contract tools from your MCP server
3. **Read** operations execute instantly and display results
4. **Write** operations show a preview, prompt for passkey signature, and submit via the OpenZeppelin Relayer (fee sponsorship — users never need XLM)

## Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 15 (App Router) |
| Styling | Tailwind CSS 3 |
| Wallet | [passkey-kit](https://github.com/kalepail/passkey-kit) v0.12 (browser WebAuthn) |
| MCP Client | [@stellar-mcp/client](https://github.com/JoseCToscano/stellar-mcp) |
| Fee Relay | [OpenZeppelin Relayer](https://docs.openzeppelin.com/relayer) (Channels) |
| Animations | framer-motion |

## Quick Start

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure environment

```bash
cp .env.example .env.local
```

Fill in `.env.local`:

| Variable | Where to get it |
|---|---|
| `NEXT_PUBLIC_MCP_SERVER_URL` | URL of your running MCP server (e.g. `http://localhost:3001/mcp`) |
| `NEXT_PUBLIC_RPC_URL` | Stellar RPC endpoint (default: `https://soroban-testnet.stellar.org`) |
| `NEXT_PUBLIC_NETWORK_PASSPHRASE` | Network passphrase (default: `Test SDF Network ; September 2015`) |
| `NEXT_PUBLIC_WALLET_WASM_HASH` | Smart wallet WASM hash on your target network (a testnet hash is provided in `.env.example`) |
| `NEXT_PUBLIC_RELAYER_URL` | OZ Relayer endpoint (testnet: `https://channels.openzeppelin.com/testnet`) |
| `NEXT_PUBLIC_RELAYER_API_KEY` | Get one at [channels.openzeppelin.com/testnet/gen](https://channels.openzeppelin.com/testnet/gen) |

### 3. Start your MCP server

The smart wallet needs a running Stellar MCP server to discover contract tools. If you generated one with `stellar-mcp generate`:

```bash
cd your-mcp-server/
USE_HTTP=true PORT=3001 node dist/index.js
```

### 4. Run the app

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## First Use

1. Open the app — you'll see the wallet setup screen
2. Click **Create New Wallet**, enter a username
3. Your browser prompts for a biometric credential (Touch ID / Face ID / hardware key)
4. PasskeyKit registers the passkey and deploys a smart wallet contract on Stellar
5. You're in — browse and call tools from the Dashboard

To reconnect later: click **Connect Existing Wallet** and authenticate with your passkey.

## Project Structure

```
src/
├── app/
│   ├── layout.tsx              Root layout (ThemeScript, fonts, metadata)
│   ├── page.tsx                Entrypoint: WalletSetup or Dashboard
│   └── globals.css             Tailwind base + CSS vars (light/dark)
├── components/
│   ├── Header.tsx              Wallet address + disconnect + theme toggle
│   ├── WalletSetup.tsx         Create / connect passkey wallet
│   ├── ToolBrowser.tsx         Read | Write tabs, tool cards grid
│   ├── ToolForm.tsx            Dynamic form for selected tool
│   ├── TransactionModal.tsx    Preview params + XDR + confirm button
│   ├── SigningOverlay.tsx      "Awaiting passkey..." overlay
│   ├── ResultToast.tsx         Success/error notification
│   ├── ReadResultCard.tsx      Render read results
│   ├── XdrViewer.tsx           Collapsible XDR with copy
│   └── ui/                    Primitives (Button, Card, Badge, Input, Skeleton)
├── hooks/
│   ├── useWallet.ts            Wallet state (keyId, contractId, create/connect/disconnect)
│   ├── useMCP.ts               Tool discovery + call wrapper
│   └── useTransaction.ts       Sign + submit state machine
└── lib/
    ├── passkey.ts              PasskeyKit + PasskeyServer (lazy init)
    ├── mcp.ts                  MCPClient factory
    ├── schema.ts               Tool arg extraction + parsing utilities
    └── utils.ts                cn() helper
```

## Transaction Flow

```
User selects tool & fills form
       |
       v
  MCP client.call(tool, args)
       |
       +-- Read? --> display result
       |
       +-- Write? --> show TransactionModal (XDR preview)
                          |
                          v
                   User clicks "Confirm & Sign"
                          |
                          v
                   PasskeyKit.sign(xdr, { keyId })  <-- WebAuthn prompt
                          |
                          v
                   PasskeyServer.send(signedTx)  <-- OZ Relayer (fee sponsored)
                          |
                          v
                   Show tx hash + explorer link
```

## Deploying Your Own WASM Hash

The `.env.example` includes a pre-deployed testnet WASM hash. To deploy your own:

```bash
git clone --branch next https://github.com/kalepail/passkey-kit.git
cd passkey-kit/contracts
stellar contract build --package smart-wallet
stellar contract optimize --wasm out/smart_wallet.wasm
stellar contract upload --wasm out/smart_wallet.optimized.wasm --source default --network testnet
```

The upload command prints the WASM hash. Set it as `NEXT_PUBLIC_WALLET_WASM_HASH`.

## Deploy to Vercel

```bash
vercel deploy
```

Set the same environment variables in your Vercel project settings.

## Notes

- Wallet state (`keyId`, `contractId`) is stored in `localStorage`
- The WASM hash must match a deployed smart wallet contract on your target network
- For mainnet: update `NETWORK_PASSPHRASE`, `RPC_URL`, `RELAYER_URL`, and the explorer link in `ResultToast.tsx`

## License

MIT

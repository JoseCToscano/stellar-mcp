# web-app — Token Factory dApp

Browser example demonstrating `@stellar-mcp/client` with Freighter wallet signing.

**Contract:** Token Factory · `CAHLJEQUCNTV7JPAPCMLCBIHOX7FFB57DUARJ6XGTW27FPCVKKY7JM2A` · Stellar testnet

---

## Setup

```bash
cd examples/web-app
npm install
npm run dev        # http://localhost:5173
```

Defaults point at testnet — no `.env` changes needed to get started.

> The Vite dev server proxies `/mcp` → `localhost:3001`, so there are no CORS issues.
> Just make sure your MCP server is running on port 3001.

Start the server first:
```bash
USE_HTTP=true PORT=3001 node dist/index.js
```

Optional `.env` overrides (copy `.env.example`):

| Variable | Default |
|---|---|
| `VITE_RPC_URL` | `https://soroban-testnet.stellar.org` |
| `VITE_NETWORK_PASSPHRASE` | testnet passphrase |

---

## Deploy to production

`npm run build` produces a fully static site in `dist/` — deploy anywhere.

Before building, set `VITE_MCP_URL` to your deployed server URL (the Vite proxy only runs in dev):

```bash
VITE_MCP_URL=https://your-mcp-server.com/mcp npm run build
```

**Vercel**
```bash
vercel --prod
# Set VITE_MCP_URL in the Vercel dashboard → Settings → Environment Variables
```

**Netlify**
```bash
netlify deploy --dir dist --prod
```

**Any static host** (GitHub Pages, Cloudflare Pages, S3, etc.) — upload `dist/` as-is.

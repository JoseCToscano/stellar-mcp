# python-server-app — SDK smoke test (Python MCP server)

Node.js smoke test for `@stellar-mcp/client` targeting a **Python-generated** MCP server.

This mirrors `node-app/` but omits PasskeyKit signing, which is not supported by the Python server generator.

**Contract:** Token Factory · `CAHLJEQUCNTV7JPAPCMLCBIHOX7FFB57DUARJ6XGTW27FPCVKKY7JM2A` · Stellar testnet

---

## Prerequisites

1. Python 3.12+ with the generated Python MCP server installed
2. Node.js 18+

---

## Start the Python MCP server

```bash
cd docs/generated-python-server
python -m venv .venv
source .venv/bin/activate
pip install -e .
USE_HTTP=true PORT=3003 python server.py
```

The server runs on `http://localhost:3003/mcp` (port 3003 to avoid conflict with the TypeScript server on 3001).

---

## Run the smoke test

```bash
cd examples/python-server-app
pnpm install
cp .env.example .env   # fill in credentials for write steps
pnpm run smoke
```

The smoke test runs 8 steps — read queries and `secretKeySigner` writes.
Steps that need credentials not set in `.env` are gracefully skipped.

| Variable | Required for |
|---|---|
| `MCP_URL` | everything |
| `TEST_SECRET_KEY` + `TEST_ADMIN_ADDRESS` | steps 6–8 (secretKey path) |

---

## Python server differences

### Tool naming: underscores instead of hyphens

The Python server uses underscores in tool names where the TypeScript server uses hyphens:

| TypeScript server | Python server |
|---|---|
| `get-admin` | `get_admin` |
| `deploy-token` | `deploy_token` |
| `get-token-count` | `get_token_count` |
| `get-deployed-tokens` | `get_deployed_tokens` |

The generated types file (`src/mcp-types.ts`) handles this automatically — run `pnpm run generate` against the Python server and the correct names are used.

### No PasskeyKit support

The Python MCP server generator does not support PasskeyKit signing. This means:

- **No `passkeyKitSigner`** — step 9 from `node-app` is omitted entirely
- **Secret key signing only** — use `secretKeySigner` for write operations
- All read-only operations work identically to the TypeScript server

If you need PasskeyKit support, use the TypeScript MCP server with the `node-app` example.

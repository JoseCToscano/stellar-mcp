# Stellar MCP CLI Template

A polished terminal agent for any Stellar MCP server. Copy this template, configure `.env`, and immediately get a CLI that can list tools, call them in one-shot mode, or guide you interactively through argument collection.

---

## Quick Start

```bash
# 1. Install dependencies
pnpm install

# 2. Configure environment
cp .env.example .env
# Edit .env: set MCP_SERVER_URL to your running MCP server

# 3. Start your MCP server (in another terminal)
#    e.g. node path/to/generated-server/dist/index.js

# 4. Run
pnpm dev                  # guided wizard
pnpm dev list             # list available tools
pnpm dev call get-admin   # call a specific tool
```

---

## Commands

| Command | Description |
|---|---|
| `stellar-mcp-cli` | Guided wizard: tool picker → args → confirm → execute |
| `stellar-mcp-cli --interactive` | REPL loop — asks "Run another?" after each op |
| `stellar-mcp-cli list` | Pretty table of all tools with READ / WRITE sections |
| `stellar-mcp-cli list --json` | JSON array to stdout (pipe-friendly) |
| `stellar-mcp-cli list --read-only` | Only read tools |
| `stellar-mcp-cli list --write-only` | Only write tools |
| `stellar-mcp-cli call [tool]` | Call a tool (omit name to pick interactively) |
| `stellar-mcp-cli call [tool] --args <json>` | Pass all args as a JSON object |
| `stellar-mcp-cli call [tool] --key val …` | Pass args as `--key value` flags |
| `stellar-mcp-cli call [tool] --json` | Output result as JSON |

---

## One-Shot Examples

```bash
# Read operation
pnpm dev call get-admin

# Read with inline flag args
pnpm dev call get-balance --address GABC1234...

# Write with JSON args
pnpm dev call deploy-token --args '{"deployer":"GABC...","config":{"admin":"GABC...","decimals":7,"name":"MyToken","symbol":"MTK"}}'

# Write with flag args
pnpm dev call transfer --to GABC... --amount 100

# Pipe list output to jq
pnpm dev list --json | jq '.[].name'
```

---

## Interactive Mode

Running `stellar-mcp-cli` with no arguments launches the wizard:

```
◆ Stellar MCP
│
◆ Select a tool
│  ▶ get-admin
│    get-token-count
│    get-deployed-tokens
│    deploy-token
│
◆ deployer
│  GABC1234...
│
◆ config.admin
│  GABC1234...
│
◆ Execute deploy-token? Yes
│
✔ Transaction submitted
  hash: abc123...
  view: https://stellar.expert/explorer/testnet/tx/abc123...
│
◆ Done
```

With `--interactive` (`stellar-mcp-cli --interactive`), the wizard repeats after each operation:

```
◆ Stellar MCP  (Ctrl+C to exit)
│
[wizard runs…]
│
◆ Run another tool? Yes
│
[wizard runs again…]
│
Goodbye!
```

---

## JSON Output

All commands support `--json` for machine-readable output:

```bash
# List tools as JSON
pnpm dev list --json

# Call result as JSON
pnpm dev call get-admin --json

# Pipe to jq
pnpm dev call get-deployed-tokens --json | jq '.[]'
```

In `--json` mode:
- All spinners and colors are suppressed
- Data goes to **stdout**
- Errors go to **stderr**
- Exit code `0` on success, `1` on error

---

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `MCP_SERVER_URL` | **Yes** | — | URL of your MCP server (e.g. `http://localhost:3000/mcp`) |
| `RPC_URL` | No | `https://soroban-testnet.stellar.org` | Soroban RPC endpoint |
| `NETWORK_PASSPHRASE` | No | `Test SDF Network ; September 2015` | Stellar network ID |
| `SIGNER_SECRET` | No | — | Secret key (`S...`) for signing write operations |

When `SIGNER_SECRET` is not set, write operations display the unsigned XDR instead of submitting. This is useful for inspecting transactions before signing.

---

## Building for Distribution

```bash
pnpm build                    # compiles src/ → dist/
node dist/index.js list       # run compiled output
```

After building, you can install the binary globally:

```bash
npm install -g .              # installs stellar-mcp-cli to PATH
stellar-mcp-cli list
```

---

## Notes

**Write operations:** Soroban simulates all contract calls, so even read-only tools return XDR. This CLI uses the tool name heuristic (tools starting with `get`, `list`, `query`, etc. are treated as reads) to determine whether to sign and submit. Override by always passing `SIGNER_SECRET` and letting the flow proceed naturally.

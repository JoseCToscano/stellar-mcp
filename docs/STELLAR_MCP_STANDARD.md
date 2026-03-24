# Stellar MCP Standard: Agent-Contract Interaction Protocol

**Version:** 1.0.0
**Status:** Final Draft
**Date:** March 2026
**Authors:** Stellar AI Agent Kit Contributors
**Repository:** https://github.com/JoseCToscano/stellar-mcp

---

## Abstract

This document defines a standard protocol for AI agent interaction with Soroban smart contracts on the Stellar network. It specifies how contract interfaces are mapped to MCP (Model Context Protocol) tool definitions, how transactions are constructed and signed under scoped policies, and how client applications consume these capabilities in a secure and interoperable manner.

The standard is implemented by the Stellar AI Agent Kit and its four components: the MCP Server Generator, Policy Signer Generator, Policy Sandbox, and the `@stellar-mcp/client` SDK.

---

## 1. Problem Statement

### 1.1 The Gap Between AI Agents and Smart Contracts

Soroban smart contracts expose their functionality through typed interfaces defined in contract specification files (`.json` specs derived from WASM metadata). These interfaces are designed for programmatic consumption by wallets and dApps — not for AI agents operating through natural language reasoning.

AI agents face three core challenges when interacting with Soroban contracts:

1. **Discovery** — An agent has no standard way to learn what a contract can do, what parameters each function expects, or what return types to anticipate.
2. **Execution** — Constructing, simulating, signing, and submitting Stellar transactions requires multi-step orchestration that is error-prone without structured tooling.
3. **Security** — Giving an AI agent unrestricted access to a signing key is unacceptable for production use. There is no existing standard for scoping what an agent is allowed to do.

### 1.2 Why MCP

The Model Context Protocol (MCP), introduced by Anthropic, provides a structured interface through which AI models discover and invoke external tools. Each tool has a name, a description, and a JSON Schema defining its inputs. This maps naturally onto Soroban contract functions, which have named parameters with known types.

By generating MCP-compliant servers from contract specs, we give any MCP-compatible AI client — Claude, GPT-based agents, open-source frameworks — a standard mechanism to interact with any Soroban contract without custom integration code.

---

## 2. Architecture Overview

### 2.1 Standard Flow

The canonical data flow for an agent invoking a Soroban contract function is:

```
Soroban Contract (.wasm)
        │
        ▼
  Contract Spec (JSON)
        │
        ▼
  MCP Server Generator (stellar mcp generate)
        │
        ▼
  Generated MCP Server (TypeScript or Python)
        │
        ▼
  MCP Client SDK (@stellar-mcp/client)
        │
        ▼
  AI Agent (Claude, GPT, custom)
```

### 2.2 Component Roles

| Component | Role | Package / Tool |
|---|---|---|
| MCP Server Generator | Parses contract specs, emits MCP tool definitions and server code | `stellar mcp generate` CLI plugin |
| Policy Signer Generator | Creates scoped signing rules via interactive CLI | `stellar policy generate` CLI |
| Policy Sandbox | Browser-based simulator for testing policy signer behavior | policies-playground |
| MCP Client SDK | TypeScript SDK for connecting to generated MCP servers | `@stellar-mcp/client` |

### 2.3 Separation of Concerns

The architecture enforces a strict separation:

- **The MCP server** knows how to build and simulate transactions. It does not hold signing keys.
- **The policy signer** knows how to evaluate and sign transactions. It does not know about MCP.
- **The agent** knows how to reason about goals and invoke tools. It does not construct XDR directly.

This separation is not incidental — it is a security requirement. No single component has both the knowledge of what to do and the authority to do it without policy checks.

---

## 3. MCP Server Generation Standard

### 3.1 Contract Spec Parsing

The MCP Server Generator accepts a Soroban contract specification (the JSON output of `soroban contract inspect` or equivalent) and produces a fully functional MCP server. The generator reads every function entry in the spec and maps it to an MCP tool definition.

### 3.2 Tool Naming Convention

Each contract function becomes an MCP tool. The naming convention is:

```
<contract_name>_<function_name>
```

Where `contract_name` is a developer-supplied identifier (typically the contract's human-readable name in snake_case) and `function_name` is taken directly from the contract spec.

Examples:
- `token_transfer`
- `amm_swap_exact_in`
- `governance_cast_vote`

Tool names MUST be lowercase alphanumeric with underscores. Hyphens in contract names are converted to underscores.

### 3.3 Parameter Mapping

Soroban types are mapped to JSON Schema types for MCP tool input definitions:

| Soroban Type | JSON Schema Type | Notes |
|---|---|---|
| `i32`, `u32` | `integer` | |
| `i64`, `u64`, `i128`, `u128` | `string` | Encoded as string to preserve precision |
| `bool` | `boolean` | |
| `Address` | `string` | Stellar address (G... or C...) |
| `String`, `Symbol` | `string` | |
| `Bytes`, `BytesN` | `string` | Hex-encoded |
| `Vec<T>` | `array` with `items` schema | Recursive mapping of inner type |
| `Map<K, V>` | `array` of `[key, value]` tuples | JSON objects are not used because Soroban map keys can be non-string types |
| `Option<T>` | Schema of `T` with `required: false` | |
| Struct | `object` with `properties` | Field names and types mapped recursively |
| Enum (unit variants) | `string` with `enum` values | |
| Enum (tuple variants) | `object` with discriminator pattern | |

### 3.4 Tool Descriptions

Every generated tool MUST include:

1. A human-readable description derived from the function's doc comments (if present in the spec) or a generated summary of the form: `"Invoke the '<function_name>' function on the <contract_name> contract."`
2. A description for each parameter, including its Soroban type in parentheses.
3. The return type, documented in the tool's description footer.

### 3.5 Output Schema

Tool invocations return a structured result:

```json
{
  "status": "simulated | submitted | confirmed | error",
  "transaction_hash": "string | null",
  "result": "<decoded return value>",
  "xdr": "string",
  "error": "string | null"
}
```

The `result` field contains the decoded return value from simulation or from ledger confirmation, mapped back from Soroban types using the inverse of the parameter mapping table.

### 3.6 Generated Server Structure

For TypeScript, the generator produces:

```
generated-server/
├── src/
│   ├── index.ts          # MCP server entry point
│   ├── lib/
│   │   ├── logger.ts     # Structured logging
│   │   └── errors.ts     # Error parsing and formatting
│   ├── types.ts          # Shared type definitions
│   └── soroban.ts        # Transaction construction utilities
├── package.json
├── Dockerfile
└── tsconfig.json
```

For Python, an equivalent structure using the MCP Python SDK is generated with one module per tool and a shared Soroban client module.

---

## 4. Transaction Lifecycle Standard

### 4.1 The Four-Step Lifecycle

Every contract invocation follows a four-step lifecycle:

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│ SIMULATE │───▶│   SIGN   │───▶│  SUBMIT  │───▶│ CONFIRM  │
└──────────┘    └──────────┘    └──────────┘    └──────────┘
```

**Step 1 — Simulate.** The MCP server constructs the transaction envelope and submits it to the Soroban RPC `simulateTransaction` endpoint. This returns resource estimates (CPU instructions, read/write bytes, ledger entries) and the transaction footprint. If simulation fails, the error is returned immediately and the lifecycle terminates.

**Step 2 — Sign.** The assembled transaction (with resource estimates applied) is serialized to XDR and passed to the configured signer. The signer evaluates the transaction against its policy rules. If the policy allows it, the signer signs the XDR and returns it. If not, the lifecycle terminates with a policy rejection error.

**Step 3 — Submit.** The signed XDR is submitted to the Stellar network via the `sendTransaction` RPC endpoint. The server receives a transaction hash and a status (typically `PENDING`).

**Step 4 — Confirm.** The server polls `getTransaction` until the transaction reaches a terminal state (`SUCCESS`, `FAILED`, or `NOT_FOUND` after timeout). The decoded result is returned to the agent.

### 4.2 XDR Handling

XDR (External Data Representation) is the binary serialization format used by Stellar. Within this standard:

- XDR is always transported as base64-encoded strings.
- The MCP server is responsible for constructing XDR from tool parameters. Agents never construct XDR directly.
- The policy signer receives XDR, decodes it to inspect the transaction, then signs it if policy allows.
- The MCP client SDK can optionally expose the raw XDR to the consuming application for audit or logging.

### 4.3 Wallet Adapter Interface

The signing step is abstracted behind a pluggable `Signer` interface:

```typescript
interface Signer {
  signTransaction(xdr: string, opts?: { networkPassphrase?: string }): Promise<string>;
}
```

This interface is intentionally minimal. The `@stellar-mcp/client` SDK provides three built-in adapters:

- **`secretKeySigner`** — Signs with a Stellar secret key. For testing and bots only.
- **`freighterSigner` / `connectFreighter`** — Delegates signing to the Freighter browser extension.
- **`passkeyKitSigner`** — Signs via PasskeyKit smart wallets using WebAuthn.

Custom adapters — any object conforming to the `Signer` interface can be provided.

### 4.4 Network Configuration

The MCP server is configured at generation time or at runtime with:

- `networkPassphrase` — `"Test SDF Network ; September 2015"` for testnet, `"Public Global Stellar Network ; September 2015"` for mainnet.
- `rpcUrl` — The Soroban RPC endpoint URL.
- `contractId` — The on-chain contract address (C...).

These values MUST NOT be hardcoded in generated servers. They are supplied via environment variables or a configuration file.

---

## 5. Policy Signer Standard

### 5.1 Purpose

A Policy Signer is a signing adapter that evaluates every transaction against a set of rules before signing. It provides the security boundary between an AI agent's intent and on-chain execution.

### 5.2 Rule Types

The Policy Signer Generator supports five rule types:

1. **Function Whitelisting** — Only specified contract functions may be invoked.
2. **Contract Whitelisting** — Only specified contract addresses may be called.
3. **Amount Caps** — Maximum amount per transaction or per time window.
4. **Rate Limiting** — Maximum number of transactions per time window.
5. **Recipient Whitelisting** — Only specified destination addresses are permitted.

### 5.3 Rule Evaluation Order

When a transaction is presented for signing, rules are evaluated in this order:

1. **Network check** — Is the transaction's network passphrase allowed?
2. **Function check** — Is the invoked contract function in the allowed set?
3. **Destination check** — Are all addresses referenced in the transaction parameters within the allowed set?
4. **Limit check** — Does this transaction's amount, combined with recent history, exceed the configured quotas?
5. **Simulation check** — Has the transaction been simulated successfully?

If any check fails, the signer rejects the transaction and returns a structured error indicating which rule was violated.

### 5.4 Policy Generation

The Policy Signer Generator (`stellar policy generate`) provides an interactive CLI that:

1. Reads the contract spec to present available functions.
2. Prompts the developer to select allowed/denied functions.
3. Prompts for destination restrictions and amount limits.
4. Outputs deployable signer configurations with Rust contracts, tests, and TypeScript bindings.

---

## 6. Security Model

### 6.1 Principle of Least Authority

The standard enforces the principle of least authority at every layer:

- **Agents** can invoke tools but cannot sign transactions.
- **MCP servers** can construct transactions but cannot sign them.
- **Policy signers** can sign transactions but only within their configured scope.
- **No component** has both unrestricted construction authority and signing authority.

### 6.2 Delegated Signing

The standard uses delegated signing rather than key sharing. An agent never has access to a private key. Instead:

1. The agent requests a tool invocation via MCP.
2. The MCP server builds the transaction and passes XDR to the signer.
3. The signer evaluates policy, signs if permitted, and returns signed XDR.
4. The MCP server submits the signed transaction.

The private key exists only within the policy signer's runtime. It is never serialized to MCP messages, tool outputs, or agent context.

### 6.3 Request Validation

Every tool invocation is validated at two levels:

**MCP-level validation:** The MCP server validates incoming parameters against the JSON Schema derived from the contract spec. Malformed requests are rejected before any transaction is constructed.

**Policy-level validation:** The policy signer decodes the transaction XDR and independently verifies that the invoked function, destination addresses, and amounts match the policy. This is a defense-in-depth measure — even if the MCP server is compromised, the signer enforces its own rules from the raw XDR.

### 6.4 Rate Limiting

Rate limits are enforced at the policy signer level (see Section 5). Additionally, generated MCP servers include configurable rate limiting middleware at the transport level (requests per minute per client) to mitigate abuse from misconfigured or malicious agents.

### 6.5 Audit Logging

Generated MCP servers emit structured logs for every tool invocation, including:

- Timestamp
- Tool name and parameters
- Simulation result (success/failure)
- Signing result (approved/rejected with reason)
- Submission result (transaction hash or error)

This log provides a complete audit trail of agent activity for compliance and debugging.

---

## 7. Template Patterns

### 7.1 Overview

The standard defines three template patterns for common agent application architectures.

### 7.2 Bot Pattern (Telegram Bot Template)

An autonomous or semi-autonomous agent that interacts with users via messaging platform and invokes contract functions.

```
User ──▶ Telegram ──▶ Bot Agent ──▶ MCP Server ──▶ Policy Signer
```

Characteristics:
- Dual interaction modes: structured form cards and AI conversational chat.
- Policy signer uses tight function allow-lists and quotas.
- Deployment: Vercel (webhook mode) or Docker (long-polling mode).

### 7.3 UI Pattern (Smart Wallet Template)

A browser-based application where users interact with contracts through a modern web UI, with optional AI assistance.

```
User ──▶ Next.js UI ──▶ MCP Server ──▶ PasskeyKit Signer
```

Characteristics:
- WebAuthn passkey-based wallet creation and management.
- Transaction simulation preview before signing.
- User retains signing authority via PasskeyKit smart wallet.
- OpenZeppelin Relayer for fee sponsorship.

### 7.4 CLI Pattern (CLI Agent Template)

A command-line tool for developers to interact with contracts through a terminal interface.

```
Developer ──▶ CLI Agent ──▶ MCP Server ──▶ Secret Key Signer
```

Characteristics:
- The MCP server runs locally alongside the CLI.
- JSON output mode for scripting and piping.
- Config file support for credentials and server connection.
- Suitable for developer workflows, testing, and contract administration.

---

## 8. Interoperability

### 8.1 MCP Client Compatibility

Generated servers conform to the MCP specification and are compatible with any MCP client, including:

- Claude Desktop and Claude Code (via MCP server configuration)
- Custom agents built with the Anthropic SDK
- Third-party MCP clients (Cursor, Windsurf, and others adopting MCP)
- The `@stellar-mcp/client` SDK (provides Stellar-specific conveniences on top of raw MCP)

### 8.2 Contract Compatibility

The generation standard works with any Soroban contract that produces a valid contract specification. There are no restrictions on contract complexity, number of functions, or custom types. The type mapping table (Section 3.3) covers all Soroban types defined in the Stellar SDK.

### 8.3 Language Support

The MCP Server Generator produces servers in two languages:

- **TypeScript** — Using the MCP TypeScript SDK (`@modelcontextprotocol/sdk`) and `@stellar/stellar-sdk` for transaction construction.
- **Python** — Using the MCP Python SDK (`mcp`) and `stellar-sdk` (the Python Stellar SDK) for transaction construction.

Both generated servers expose identical tool definitions and behavior.

### 8.4 Transport Support

Generated servers support the following MCP transports:

- **stdio** — For local development and CLI integration.
- **SSE (Server-Sent Events)** — For remote deployment and browser-based clients.

The transport choice does not affect tool definitions or behavior.

---

## 9. Future Considerations

### 9.1 SEP Submission

Based on community adoption and developer feedback, the authors intend to submit a formal Stellar Ecosystem Proposal (SEP) that standardizes AI agent interaction with Soroban contracts across the ecosystem. A SEP submission would cover canonical tool naming for well-known contracts (e.g., SEP-41 token interfaces), cross-implementation interoperability requirements, and standardized policy signer formats.

### 9.2 Mainnet Hardening

Before recommending production mainnet use, the following areas require further work:

- **Policy signer persistence** — Production signers need durable quota storage.
- **Key management integration** — Integration with HSMs, KMS services, and institutional custody.
- **Monitoring and alerting** — Standardized metrics for policy violations and anomalous agent behavior.
- **Multi-signature support** — Extending the wallet adapter interface for multi-sig flows.

### 9.3 Multi-Contract Orchestration

Future versions will address agents that compose transactions across multiple contracts, atomic batch operations using Soroban's authorization framework, and cross-contract policy evaluation.

---

## Appendix A: Glossary

| Term | Definition |
|---|---|
| **MCP** | Model Context Protocol — a standard for AI tool discovery and invocation |
| **Soroban** | Stellar's smart contract platform |
| **XDR** | External Data Representation — Stellar's binary serialization format |
| **Policy Signer** | A signing adapter that enforces scoped rules before signing transactions |
| **Tool** | An MCP primitive representing a callable function with typed inputs and outputs |
| **Contract Spec** | A JSON representation of a Soroban contract's public interface |
| **Wallet Adapter** | An abstraction for transaction signing that decouples key management from transaction construction |
| **PasskeyKit** | WebAuthn-based smart wallet framework for Stellar |

---

*This document represents the current state of the standard and will evolve based on ecosystem adoption and community input.*

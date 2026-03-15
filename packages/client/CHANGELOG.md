# Changelog

All notable changes to `@stellar-mcp/client` are documented here.

## [0.1.1] - 2026-03-15

### Added

- **Schema utilities** — presentation-layer helpers for building UIs on top of MCP tool definitions, exported directly from `@stellar-mcp/client`:
  - `extractArgs(tool)` — flattens a tool's `inputSchema` into a sorted, display-ready `ArgDef[]`. Handles nested objects (recursively expanded with path tracking), discriminated unions (`oneOf`/`anyOf` with `{ tag: "Value" }` pattern → enum fields), nullable types, and enum fields.
  - `buildToolArgs(args, collected)` — reconstructs the nested args object from a flat key→value map (ready to pass to `client.call()`). Automatically wraps union tag values as `{ tag: value }`.
  - `parseArgValue(value, arg)` — coerces a user-typed string into the correct JS type (`number`, `boolean`, JSON-parsed object/array, or string).
  - `isReadOperation(toolName)` — heuristic that returns `true` for tool names starting with read-only prefixes (`get`, `list`, `query`, `fetch`, `find`, `search`, `is`, `has`, `check`, `count`, `show`, `view`, `read`).
  - `argKey(arg)` — derives a unique dot-separated key from an arg's path (used as map key for collected values).
  - `ArgDef` — exported interface describing a single flattened tool argument.

These were previously hand-coded in each template (`telegram-bot`, `smart-wallet`). They now live in the SDK so any client built on top of `@stellar-mcp/client` gets them without reimplementing schema parsing.

## [0.1.0] - 2026-03-11

### Added

- Initial release of `@stellar-mcp/client`
- `MCPClient` — type-safe programmatic client for Stellar MCP servers
- `listTools()` — discover tools from any MCP server
- `call()` — invoke tools with full TypeScript inference (typed via generated `ToolMap` or manually)
- `signAndSubmit()` — sign and broadcast transactions via pluggable signer adapters
- Built-in signers: `secretKeySigner`, `freighterSigner`, `passkeyKitSigner`
- Transport negotiation: StreamableHTTP with SSE fallback
- `mcp-generate-types` CLI for generating typed `ToolMap` files from a live server

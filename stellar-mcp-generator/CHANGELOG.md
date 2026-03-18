# Changelog

All notable changes to the Stellar MCP Generator are documented in this file.

## [Unreleased]

### Added

- **Docker support (TypeScript)** — `Dockerfile` generated with multi-stage build (node:20-alpine), pnpm via corepack, non-root user, health check, `CI=true` for non-interactive Docker builds
- **Docker support (Python)** — `Dockerfile` generated with python:3.11-slim, pip install, non-root user, health check
- **`.dockerignore`** — Generated for both TypeScript (`node_modules`, `dist`, `.env`) and Python (`__pycache__`, `.venv`, `.env`) to prevent build context bloat and pnpm symlink conflicts
- **`vercel.json`** — Generated alongside the MCP server with Node.js runtime config and `/mcp` route mapping
- **Rate limiting (TypeScript)** — Sliding-window per-IP rate limiter on `/mcp` endpoint, configurable via `RATE_LIMIT` env var (default: 100 req/min), returns HTTP 429 with `Retry-After` header
- **Rate limiting (Python)** — Pure ASGI middleware (`_RateLimitedApp`) wrapping FastMCP's `http_app()`, same sliding-window per-IP logic, 429 + `Retry-After` header
- **Generated README deployment sections** — Docker deployment (build + run commands), Vercel deployment (CLI steps + env vars), HTTP transport mode, rate limiting documentation
- **Deployment tests** — 34 Rust tests covering Dockerfile templates, `.dockerignore`, `vercel.json`, rate limiting, generator wiring, and generated README content

### Fixed

- **Dockerfile template used npm instead of pnpm** — Updated to use `corepack enable && corepack prepare pnpm@latest --activate`
- **Docker build failed with pnpm symlink conflicts** — Added `.dockerignore` to exclude `node_modules` from build context
- **Docker build failed with `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`** — Added `ENV CI=true` to builder stage
- **TypeScript rate limiting was dead code** — `templates/index.ts.hbs` had rate limiting but was never used; the generator builds `index.ts` inline via `push_str`. Added rate limiting directly to the inline generation in `render_index_template()`
- **Python `RATE_LIMIT` was documentation-only** — `.env.example` referenced `RATE_LIMIT` but `server.py` had no implementation. Added ASGI rate limiting middleware
- **FastMCP 3.x breaking API change** — `stateless_http` moved from `FastMCP()` constructor to `http_app()`. `streamable_http_app()` renamed to `http_app(transport="streamable-http")`. Updated template to use correct API

### Changed (Breaking Change Mitigations)

- **`@stellar/stellar-sdk` pinned to `~14.4.0`** — v14.6.1 introduced a broken `require('../../package.json')` relative path in `lib/minimal/bindings/config.js` that causes runtime errors when the SDK is kept as an esbuild external. Pinning to `~14.4.0` (compatible with 14.4.x) avoids this regression while still receiving patch updates
- **`fastmcp` pinned to `~=3.1`** — FastMCP 3.x removed `stateless_http` from the constructor and renamed `streamable_http_app()` to `http_app()`. The `~=3.1` pin (equivalent to `>=3.1,<4.0`) locks to the tested API surface while allowing patch/minor updates
- **`stellar-sdk` (Python) pinned to `~=13.2`** — Same rationale as the TypeScript SDK pin; avoids surprise breaking changes from unpinned major version ranges
- **`uvicorn` added as explicit Python dependency** — Rate limiting requires `uvicorn.run()` directly instead of going through `mcp.run()`, so uvicorn must be a declared dependency

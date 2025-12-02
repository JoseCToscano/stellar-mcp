# Stellar Policy CLI

A Stellar CLI plugin that generates production-ready policy smart contracts for smart wallets through an interactive wizard.

## Overview

The Stellar Policy CLI helps developers create policy smart contracts that enforce authorization rules for Stellar smart wallets built with passkey-kit. Instead of manually writing Rust policy contracts, the CLI guides you through an interactive wizard and generates complete, tested code.

## Features

- **Interactive Wizard** - Q&A interface to collect policy requirements
- **Multiple Policy Types** - Function whitelisting, contract whitelisting, amount caps, rate limiting, recipient whitelisting
- **Smart Recommendations** - Auto-detects whether admin functionality is needed
- **Complete Project Generation** - Generates Cargo workspace with contracts, tests, build scripts, and documentation
- **TypeScript Integration** - Automated bindings generation with type fixes and examples for smart wallet integration
- **Deployment Ready** - Makefile with build, test, deploy, and bindings commands
- **Production Quality** - Includes comprehensive tests, error handling, and best practices

## Installation

```bash
git clone https://github.com/stellar/stellar-policy-cli
cd stellar-policy-cli
cargo install --path .
```

Verify installation:

```bash
stellar policy --help
```

## Usage

### Generate a Policy Contract

Run the interactive wizard:

```bash
stellar policy generate
```

The wizard will guide you through:

1. **Basic Information** - Policy name and description
2. **Policy Rules** - Select which policy types to enable
3. **Analysis** - Review policy requirements and admin recommendation
4. **Generation** - Creates complete project with all files

### Example Workflow

```bash
# Generate a policy contract
stellar policy generate

# Navigate to generated project
cd my-policy

# Build the contract
make build

# Run tests
make test

# Deploy to testnet
make deploy-testnet

# Generate TypeScript bindings
make bindings

# Build TypeScript SDK
cd my-policy-sdk && pnpm install && pnpm build
```

## Policy Types

### Function Whitelisting

Restrict which contract functions can be called through the smart wallet.

**Example:** Allow only `transfer` and `approve` functions

### Contract Whitelisting

Limit which contracts the smart wallet can interact with.

**Example:** Only allow calls to a specific DEX contract

### Amount Caps

Set maximum transaction amounts.

**Example:** Maximum 1000 tokens per operation

### Rate Limiting

Enforce time delays between transactions.

**Example:** Minimum 10 ledgers between transactions

### Recipient Whitelisting

Restrict destination addresses for transfers.

**Example:** Only allow transfers to treasury address

## Requirements

- Rust 1.85+ with stable toolchain
- Stellar CLI 23.0+
- wasm32-unknown-unknown target (`rustup target add wasm32-unknown-unknown`)
- pnpm (for TypeScript SDK integration)

## Generated Project Structure

When you run `stellar policy generate`, the CLI creates a complete project:

```
my-policy/
├── contracts/
│   ├── Cargo.toml                    # Workspace configuration
│   ├── rust-toolchain.toml           # Rust version pinning
│   └── my-policy/
│       ├── Cargo.toml                # Contract dependencies
│       └── src/
│           ├── lib.rs                # Main contract code
│           ├── types.rs              # Storage types (admin-managed only)
│           └── test.rs               # Contract tests
├── scripts/
│   └── fix-bindings.sh               # TypeScript bindings post-processor
├── examples/
│   └── typescript-integration.ts     # Integration example
├── Makefile                          # Build, test, deploy, bindings
├── package.json                      # TypeScript project config
├── tsconfig.json                     # TypeScript compiler config
├── .env.example                      # Environment variables template
└── README.md                         # Project-specific documentation
```

## TypeScript Integration

Generated projects include automated TypeScript bindings generation:

```bash
# After deploying your contract
make bindings

# This automatically:
# 1. Generates TypeScript SDK using stellar-cli
# 2. Fixes missing type definitions (SignerKey, Context)
# 3. Creates {policy-name}-sdk/ directory

# Then build the SDK
cd {policy-name}-sdk
pnpm install
pnpm build

# Run the integration example
cd ..
pnpm install
pnpm example
```

**Why the type fix is needed:** The `smart-wallet-interface` types (`SignerKey`, `Context`) have `export = false` in their Rust definition, so they're not included in the contract spec. The `fix-bindings.sh` script automatically injects these type definitions after bindings generation.

## Project Status

**Current Version:** 0.1.0

**Implementation Status:**

- ✅ Story 1.1: Core CLI Structure & Plugin Setup
- ✅ Story 1.2: Interactive Wizard Implementation
- ✅ Story 1.3: Template Generation Engine
- ✅ Story 1.4: TypeScript Integration & Bindings
- ✅ Story 1.5: Documentation & Examples

## Development

### Build from Source

```bash
cargo build
```

### Run Tests

```bash
cargo test
```

### Install Locally

```bash
cargo install --path .
```

### Code Quality

```bash
# Format code
cargo fmt

# Lint code
cargo clippy
```

## Architecture

This plugin follows the Phase 1 MCP Generator architecture patterns:

- **main.rs** - Entry point that calls `lib::run()`
- **lib.rs** - Clap CLI definitions with Parser and Subcommand derives
- **commands/** - Command implementations
- **types.rs** - PolicyConfig data model
- **wizard/** - Interactive prompts and policy analysis (Story 1.2)
- **generator/** - Template rendering and project scaffolding (Story 1.3)

## Contributing

Contributions are welcome! Please ensure:

- Code is formatted with `cargo fmt`
- All tests pass (`cargo test`)
- Clippy checks pass (`cargo clippy`)
- New features include tests and documentation

## License

Apache-2.0

## Support

For issues or questions:

- GitHub Issues: https://github.com/stellar/stellar-policy-cli/issues
- Stellar Community: https://stellar.org/community

# stellar-mcp

A Model Context Protocol (MCP) server implementation for interacting with the Stellar blockchain network. This server enables AI agents and LLMs to perform Stellar blockchain operations through a standardized interface.

## What is MCP?

Model Context Protocol (MCP) is an open protocol that standardizes how applications provide context to LLMs (Large Language Models). Think of MCP like a USB-C port for AI applications - it provides a standardized way to connect AI models to different data sources and tools.

## Why Stellar MCP?

This MCP server implementation provides AI agents with direct access to Stellar blockchain functionality, enabling them to:

- Create and manage Stellar accounts
- Fund accounts with testnet lumens
- Fetch account information and transaction history
- Sign and submit Soroban smart contract transactions
- Interact with Passkey wallets

## Features

- **Account Management**
  - Create new Stellar accounts
  - Fund accounts using Friendbot (testnet)
  - Fetch account details and balances
- **Transaction Operations**
  - View transaction history
  - Sign and submit Soroban transactions
  - Support for both regular Stellar wallets and Passkey wallets
- **Smart Contract Integration**
  - Interact with Soroban smart contracts
  - Handle contract authorization
  - Support for wallet contract interactions

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- A Stellar testnet account (for testing)

### Installation

1. Clone the repository:

```bash
git clone https://github.com/JoseCToscano/stellar-mcp.git
cd stellar-mcp
```

2. Install dependencies:

```bash
npm install
```

3. Create a `.env` file with the following configuration:

```env
NETWORK_PASSPHRASE=Test SDF Network ; September 2015
RPC_URL=https://soroban-testnet.stellar.org
LAUNCHTUBE_URL=your_launchtube_url
LAUNCHTUBE_JWT=your_launchtube_jwt
MERCURY_PROJECT_NAME=your_mercury_project
MERCURY_URL=your_mercury_url
MERCURY_JWT=your_mercury_jwt
WALLET_WASM_HASH=your_wallet_wasm_hash
```

### Running the Server

```bash
npm run start:dev src/mcp-server.ts
```

## Usage Examples

### 1. Creating a New Stellar Account

```typescript
// Example MCP tool call
await server.tool('create-account', {});
```

### 2. Funding an Account with Testnet Lumens

```typescript
// Example MCP tool call
await server.tool('fund-account', {
  address: 'GCYK...KLMN',
});
```

### 3. Fetching Account Information

```typescript
// Example MCP tool call
await server.tool('get-account', {
  address: 'GCYK...KLMN',
});
```

### 4. Submitting a Soroban Transaction

```typescript
// Example MCP tool call
await server.tool('sign-and-submit-transaction', {
  transactionXdr: 'AAAAAgA...',
  contractId: 'CC...',
  secretKey: 'SDFG...',
});
```

## Key Components

### MCP Server (`mcp-server.ts`)

The main server implementation that exposes Stellar blockchain functionality through MCP tools:

- `create-account`: Generates new Stellar keypairs
- `fund-account`: Funds testnet accounts using Friendbot
- `get-account`: Retrieves account information
- `get-transactions`: Fetches transaction history
- `sign-and-submit-transaction`: Signs and submits Soroban transactions

### Utilities (`utils.ts`)

Helper functions for:

- Passkey wallet integration
- Transaction signing logic
- Resource file handling
- Launchtube submission
- SAC (Stellar Asset Contract) client creation

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

ISC

## Support

For questions and support, please open an issue in the GitHub repository.

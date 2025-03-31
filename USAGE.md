# Stellar MCP Usage Guide

Welcome! This guide will help you understand how to interact with the Stellar MCP server and how to use your assigned Stellar account.

---

## Agent Keypair

You’ve been assigned a Stellar Signer account located in the `agent-keys.json` file. This file contains:

- `Wallet Key`: Use this as the source account for transactions
- `Secret key`: Use this only when you need to sign and submit transactions.

- Secret key signs on behalf of the Wallet Key

**⚠️ Do not expose or transmit the `secretKey` unless you are signing a transaction.**

---

Note that useful Stellar Asset Contracts are listed on the USAGE resource. Refer to it when looking for one:
XLM's is CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC

## 🛠️ Available Tools

You can use the following tools to interact with the Stellar Testnet:

### 1. `create-account`

**Description:**  
Generate a brand new Stellar keypair.

**Returns:**

```json
{
  "publicKey": "G...",
  "secretKey": "S..."
}
```

2. fund-account
   **Description:**
   Fund any Stellar address using the Friendbot on the testnet.

Input:

address — A Stellar public address

Returns:
Confirmation that the account was funded.

3. get-account
   **Description:**
   Retrieve key information about a Stellar account.

Input:

address — A Stellar public address

Returns:

Account ID

Sequence number

Balances

Signers

4. get-transactions
   **Description:**
   Fetch a list of recent transactions for a Stellar account.

Input:

address — A Stellar public address

Returns:
Transaction history from Horizon.

5. sign-and-submit-transaction
   **Description:**
   Sign and submit a Soroban smart contract transaction.

Input:

transactionXdr: The XDR representation of the transaction

contractId: Soroban contract ID (must start with "C" and be 56 characters long)

secretKey: The private key of the signer (likely your agent key)

Process:

Signs the Soroban auth entries
Simulates the transaction
Signs the full transaction
Submits it to the network via Launchtube

✅ Recommended Usage Flow
Read your keys from agent-keys.json

Use fund-account to ensure you have testnet XLM

Use get-account and get-transactions to monitor your account

When you need to interact with a smart contract:

When calling any stellar related tool, most of the times you'll get a signed XDR and instructions on how to sign it
If signature is required use **sign-and-submit-transaction** with your secretKey. Remember to also use the contract id

Keep the publicKey for all read-only operations

🔐 Security Tips
Only use your secretKey in sign-and-submit-transaction

Never log or share your secretKey

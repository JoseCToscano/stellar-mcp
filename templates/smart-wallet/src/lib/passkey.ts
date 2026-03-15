'use client';

// src/lib/passkey.ts
//
// PasskeyKit + PasskeyServer — lazily initialized.
// Throws a clear error if env vars are missing rather than crashing silently.

import { PasskeyKit, PasskeyServer } from 'passkey-kit';

let _account: PasskeyKit | null = null;
let _server: PasskeyServer | null = null;

export function getAccount(): PasskeyKit {
  if (!_account) {
    const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL;
    const networkPassphrase = process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE;
    const walletWasmHash = process.env.NEXT_PUBLIC_WALLET_WASM_HASH;

    if (!rpcUrl || !networkPassphrase || !walletWasmHash) {
      throw new Error(
        'Missing PasskeyKit config. Set NEXT_PUBLIC_RPC_URL, NEXT_PUBLIC_NETWORK_PASSPHRASE, and NEXT_PUBLIC_WALLET_WASM_HASH in .env.local'
      );
    }

    _account = new PasskeyKit({ rpcUrl, networkPassphrase, walletWasmHash });
  }
  return _account;
}

export function getServer(): PasskeyServer {
  if (!_server) {
    const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL;
    const relayerUrl = process.env.NEXT_PUBLIC_RELAYER_URL;
    const relayerApiKey = process.env.NEXT_PUBLIC_RELAYER_API_KEY;

    if (!rpcUrl || !relayerUrl || !relayerApiKey) {
      throw new Error(
        'Missing Relayer config. Set NEXT_PUBLIC_RELAYER_URL and NEXT_PUBLIC_RELAYER_API_KEY in .env.local'
      );
    }

    _server = new PasskeyServer({ rpcUrl, relayerUrl, relayerApiKey });
  }
  return _server;
}

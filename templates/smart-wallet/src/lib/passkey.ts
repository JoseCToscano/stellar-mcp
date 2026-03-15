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
    const launchtubeUrl = process.env.NEXT_PUBLIC_LAUNCHTUBE_URL;
    const launchtubeJwt = process.env.NEXT_PUBLIC_LAUNCHTUBE_JWT;

    if (!rpcUrl || !launchtubeUrl || !launchtubeJwt) {
      throw new Error(
        'Missing Launchtube config. Set NEXT_PUBLIC_LAUNCHTUBE_URL and NEXT_PUBLIC_LAUNCHTUBE_JWT in .env.local'
      );
    }

    _server = new PasskeyServer({ rpcUrl, launchtubeUrl, launchtubeJwt });
  }
  return _server;
}

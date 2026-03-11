'use client';

// src/lib/passkey.ts
//
// PasskeyKit + PasskeyServer singletons.
// Both are instantiated once (client-side only) and reused across the app.
// Pattern mirrors docs/repo/kale-site/src/utils/passkey-kit.ts.

import { PasskeyKit, PasskeyServer } from 'passkey-kit';

export const account = new PasskeyKit({
  rpcUrl: process.env.NEXT_PUBLIC_RPC_URL!,
  networkPassphrase: process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE!,
  walletWasmHash: process.env.NEXT_PUBLIC_WALLET_WASM_HASH!,
});

export const server = new PasskeyServer({
  rpcUrl: process.env.NEXT_PUBLIC_RPC_URL!,
  launchtubeUrl: process.env.NEXT_PUBLIC_LAUNCHTUBE_URL!,
  launchtubeJwt: process.env.NEXT_PUBLIC_LAUNCHTUBE_JWT!,
});

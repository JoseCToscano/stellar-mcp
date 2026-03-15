'use client';

// src/hooks/useWallet.ts
//
// Manages PasskeyKit wallet state: keyId + contractId.
// Persisted in localStorage under 'sw:keyId' and 'sw:contractId'.
//
// Transaction flow:
//   createWallet → submit deploy tx directly to Stellar RPC
//     The deploy tx uses walletKeypair as source (funded via friendbot on testnet).
//     Direct RPC submission avoids the OZ Relayer's strict fee validation, which
//     rejects the doubled fee produced by stellar-sdk's AssembledTransaction.sign().
//
//   All write operations (after wallet deployed) → OZ Relayer via getServer().send()
//     This is why NEXT_PUBLIC_RELAYER_API_KEY is required: fee-sponsored user txs.

import { useState, useCallback, useEffect } from 'react';
import type { Api } from '@stellar/stellar-sdk/rpc';
import { getAccount, getServer, initWallet } from '@/lib/passkey';

const KEY_ID_KEY = 'sw:keyId';
const CONTRACT_ID_KEY = 'sw:contractId';

export interface WalletState {
  keyId: string | null;
  contractId: string | null;
  isConnecting: boolean;
  error: string | null;
  createWallet: (username: string) => Promise<void>;
  connectWallet: () => Promise<void>;
  disconnect: () => void;
}

export function useWallet(): WalletState {
  const [keyId, setKeyId] = useState<string | null>(null);
  const [contractId, setContractId] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load from localStorage on mount (client-only) and re-init PasskeyKit wallet
  useEffect(() => {
    const storedKeyId = localStorage.getItem(KEY_ID_KEY);
    const storedContractId = localStorage.getItem(CONTRACT_ID_KEY);
    if (storedKeyId) setKeyId(storedKeyId);
    if (storedContractId) {
      setContractId(storedContractId);
      // Re-initialize PasskeyKit's internal wallet client so sign() works
      // after page refresh without requiring another WebAuthn prompt.
      initWallet(storedContractId);
    }
  }, []);

  const persist = useCallback((kId: string, cId: string) => {
    localStorage.setItem(KEY_ID_KEY, kId);
    localStorage.setItem(CONTRACT_ID_KEY, cId);
    setKeyId(kId);
    setContractId(cId);
  }, []);

  const createWallet = useCallback(
    async (username: string) => {
      setIsConnecting(true);
      setError(null);
      try {
        const account = getAccount();
        const result = await account.createWallet('Stellar MCP', username);

        // The deploy tx uses walletKeypair as source account.
        // Fund it via friendbot (testnet only) — safe to ignore if already funded.
        const sourceAddr = (result.signedTx as { source?: string }).source;
        if (sourceAddr) {
          try {
            await fetch(`https://friendbot.stellar.org?addr=${sourceAddr}`);
          } catch {
            // Already funded — ignore
          }
        }

        // Submit directly to the Stellar RPC (not the OZ Relayer).
        // The walletKeypair source account pays the fee from its own balance.
        // The OZ Relayer is used for all subsequent user write operations.
        const rpc = account.rpc!;
        const sendResponse = await rpc.sendTransaction(result.signedTx);

        if (sendResponse.status === 'ERROR') {
          throw new Error(`Deploy failed to submit: ${JSON.stringify(sendResponse.errorResult ?? '')}`);
        }

        // Poll until confirmed (up to ~60s)
        const txHash = sendResponse.hash;
        let getResponse: Api.GetTransactionResponse | undefined;
        for (let i = 0; i < 30; i++) {
          await new Promise((r) => setTimeout(r, 2000));
          getResponse = await rpc.getTransaction(txHash);
          if (getResponse.status !== 'NOT_FOUND') break;
        }

        if (!getResponse || getResponse.status !== 'SUCCESS') {
          throw new Error(`Deploy failed: ${getResponse?.status ?? 'TIMEOUT'}`);
        }

        persist(result.keyIdBase64, result.contractId);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to create wallet';
        setError(msg);
        throw err;
      } finally {
        setIsConnecting(false);
      }
    },
    [persist],
  );

  const connectWallet = useCallback(async () => {
    setIsConnecting(true);
    setError(null);
    try {
      const result = await getAccount().connectWallet({});
      persist(result.keyIdBase64, result.contractId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to connect wallet';
      setError(msg);
      throw err;
    } finally {
      setIsConnecting(false);
    }
  }, [persist]);

  const disconnect = useCallback(() => {
    localStorage.removeItem(KEY_ID_KEY);
    localStorage.removeItem(CONTRACT_ID_KEY);
    setKeyId(null);
    setContractId(null);
    setError(null);
  }, []);

  return { keyId, contractId, isConnecting, error, createWallet, connectWallet, disconnect };
}

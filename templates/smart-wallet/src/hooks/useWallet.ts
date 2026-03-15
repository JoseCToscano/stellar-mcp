'use client';

// src/hooks/useWallet.ts
//
// Manages PasskeyKit wallet state: keyId + contractId.
// Persisted in localStorage under 'sw:keyId' and 'sw:contractId'.

import { useState, useCallback, useEffect } from 'react';
import { getAccount } from '@/lib/passkey';

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

  // Load from localStorage on mount (client-only)
  useEffect(() => {
    const storedKeyId = localStorage.getItem(KEY_ID_KEY);
    const storedContractId = localStorage.getItem(CONTRACT_ID_KEY);
    if (storedKeyId) setKeyId(storedKeyId);
    if (storedContractId) setContractId(storedContractId);
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
        const result = await getAccount().createWallet('Stellar MCP', username);
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

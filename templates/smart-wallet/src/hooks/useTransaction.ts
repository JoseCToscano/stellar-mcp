'use client';

// src/hooks/useTransaction.ts
//
// State machine for the full PasskeyKit sign + submit flow.
// States: idle → simulating → previewing → signing → submitting → success | error

import { useState, useCallback } from 'react';
import { getAccount, getServer } from '@/lib/passkey';
import { createClient } from '@/lib/mcp';
import { isReadOperation } from '@stellar-mcp/client';

export type TxPhase =
  | 'idle'
  | 'simulating'
  | 'previewing'
  | 'signing'
  | 'submitting'
  | 'success'
  | 'error';

export interface TransactionState {
  phase: TxPhase;
  pendingXdr: string | null;
  pendingToolName: string | null;
  pendingArgs: Record<string, unknown> | null;
  readResult: unknown | null;
  txHash: string | null;
  error: string | null;

  // Actions
  execute: (toolName: string, args: Record<string, unknown>) => Promise<void>;
  confirm: (keyId: string) => Promise<void>;
  cancel: () => void;
  reset: () => void;
}

export function useTransaction(): TransactionState {
  const [phase, setPhase] = useState<TxPhase>('idle');
  const [pendingXdr, setPendingXdr] = useState<string | null>(null);
  const [pendingToolName, setPendingToolName] = useState<string | null>(null);
  const [pendingArgs, setPendingArgs] = useState<Record<string, unknown> | null>(null);
  const [readResult, setReadResult] = useState<unknown | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setPhase('idle');
    setPendingXdr(null);
    setPendingToolName(null);
    setPendingArgs(null);
    setReadResult(null);
    setTxHash(null);
    setError(null);
  }, []);

  const cancel = useCallback(() => {
    setPhase('idle');
    setPendingXdr(null);
    setPendingToolName(null);
    setPendingArgs(null);
  }, []);

  // Step 1: call the tool via MCP → get XDR or read result
  const execute = useCallback(
    async (toolName: string, args: Record<string, unknown>) => {
      reset();
      setPhase('simulating');

      const client = createClient();
      try {
        // Inject contractId as source account for write tools
        const callArgs = { ...args };

        const result = await client.call(toolName, callArgs);

        if (isReadOperation(toolName) || !result.xdr) {
          // Read operation — display result directly, no signing
          setReadResult(result.simulationResult ?? result.data);
          setPhase('success');
          return;
        }

        // Write operation — show preview modal
        setPendingXdr(result.xdr);
        setPendingToolName(toolName);
        setPendingArgs(args);
        setPhase('previewing');
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Tool call failed';
        setError(msg);
        setPhase('error');
      } finally {
        client.close();
      }
    },
    [reset],
  );

  // Step 2: user confirms → WebAuthn sign → OZ Relayer submit
  const confirm = useCallback(
    async (keyId: string) => {
      if (!pendingXdr) return;

      setPhase('signing');
      try {
        // account.sign accepts XDR string directly (avoids stellar-sdk type mismatch)
        const signed = await getAccount().sign(pendingXdr, { keyId });

        setPhase('submitting');
        const result = await getServer().send(signed);

        // OZ Relayer returns { hash, transactionId, status }
        const res = result as unknown as { hash?: string; transactionId?: string } | null;
        const hash = res?.hash ?? res?.transactionId ?? '';

        setTxHash(hash);
        setPendingXdr(null);
        setPendingToolName(null);
        setPendingArgs(null);
        setPhase('success');
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Transaction failed';
        setError(msg);
        setPhase('error');
      }
    },
    [pendingXdr],
  );

  return {
    phase,
    pendingXdr,
    pendingToolName,
    pendingArgs,
    readResult,
    txHash,
    error,
    execute,
    confirm,
    cancel,
    reset,
  };
}

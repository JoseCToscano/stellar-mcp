'use client';

// src/hooks/useTransaction.ts
//
// State machine for the full PasskeyKit sign + submit flow.
// States: idle → simulating → previewing → signing → submitting → success | error
//
// v0.2.0: write operations now call client.simulate() which returns the
// estimated fee alongside the XDR, so the TransactionModal can show users
// the cost before they confirm.

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
  /** Estimated fee in stroops returned by simulate(), null until a write op is previewed */
  simulationFee: string | null;

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
  const [simulationFee, setSimulationFee] = useState<string | null>(null);

  const reset = useCallback(() => {
    setPhase('idle');
    setPendingXdr(null);
    setPendingToolName(null);
    setPendingArgs(null);
    setReadResult(null);
    setTxHash(null);
    setError(null);
    setSimulationFee(null);
  }, []);

  const cancel = useCallback(() => {
    setPhase('idle');
    setPendingXdr(null);
    setPendingToolName(null);
    setPendingArgs(null);
    setSimulationFee(null);
  }, []);

  // Step 1: call the tool via MCP → get XDR + fee estimate (write) or read result
  const execute = useCallback(
    async (toolName: string, args: Record<string, unknown>) => {
      reset();
      setPhase('simulating');

      const client = createClient();
      try {
        const callArgs = { ...args };

        if (isReadOperation(toolName)) {
          // Read operation — call directly, no fee preview needed
          const result = await client.call(toolName, callArgs);
          setReadResult(result.simulationResult ?? result.data);
          setPhase('success');
          return;
        }

        // Write operation — simulate to get fee estimate alongside the XDR
        const preview = await client.simulate(toolName, callArgs);

        if (!preview.xdr) {
          // Server returned no XDR — treat as read result
          setReadResult(preview.simulationResult);
          setPhase('success');
          return;
        }

        // Store fee and transition to confirmation modal
        setSimulationFee(preview.fee ?? null);
        setPendingXdr(preview.xdr);
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
        setSimulationFee(null);
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
    simulationFee,
    execute,
    confirm,
    cancel,
    reset,
  };
}

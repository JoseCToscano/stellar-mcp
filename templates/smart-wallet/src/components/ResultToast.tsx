'use client';

// src/components/ResultToast.tsx
//
// Slide-in toast notification: success (tx hash + explorer link) or error.
// Auto-dismisses after 8 seconds.

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ResultToastProps {
  phase: 'success' | 'error' | string;
  txHash: string | null;
  error: string | null;
  onDismiss: () => void;
}

const EXPLORER_BASE = 'https://stellar.expert/explorer/testnet/tx/';

export function ResultToast({ phase, txHash, error, onDismiss }: ResultToastProps) {
  const [visible, setVisible] = useState(false);

  const dismiss = useCallback(() => {
    setVisible(false);
    setTimeout(onDismiss, 300); // wait for exit animation
  }, [onDismiss]);

  useEffect(() => {
    if (phase === 'success' || phase === 'error') {
      setVisible(true);
      const timer = setTimeout(dismiss, 8000);
      return () => clearTimeout(timer);
    } else {
      setVisible(false);
    }
  }, [phase, dismiss]);

  const isSuccess = phase === 'success';

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="toast"
          initial={{ opacity: 0, x: 20, y: 0 }}
          animate={{ opacity: 1, x: 0, y: 0 }}
          exit={{ opacity: 0, x: 20 }}
          className="fixed bottom-5 right-5 z-[70] max-w-sm w-full"
        >
          <div
            className={`rounded-xl border shadow-xl p-4 space-y-2 ${
              isSuccess
                ? 'border-green-500/30 bg-green-500/10'
                : 'border-[hsl(var(--destructive))]/30 bg-[hsl(var(--destructive))]/10'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className={`text-lg ${isSuccess ? 'text-green-400' : 'text-red-400'}`}>
                  {isSuccess ? '✓' : '✕'}
                </span>
                <span className="font-semibold text-sm">
                  {isSuccess ? 'Transaction submitted' : 'Transaction failed'}
                </span>
              </div>
              <button
                onClick={dismiss}
                className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors text-xs"
              >
                ✕
              </button>
            </div>

            {isSuccess && txHash && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs break-all text-[hsl(var(--foreground))]">
                    {txHash.slice(0, 20)}…{txHash.slice(-8)}
                  </span>
                  <button
                    onClick={() => navigator.clipboard.writeText(txHash)}
                    className="text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] shrink-0"
                    title="Copy hash"
                  >
                    ⎘
                  </button>
                </div>
                <a
                  href={`${EXPLORER_BASE}${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-[hsl(var(--primary))] hover:underline"
                >
                  View on Stellar Expert →
                </a>
              </div>
            )}

            {!isSuccess && error && (
              <p className="text-xs text-[hsl(var(--muted-foreground))] break-words">{error}</p>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

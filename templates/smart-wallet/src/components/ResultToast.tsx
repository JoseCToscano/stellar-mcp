'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, AlertCircle, ExternalLink, X } from 'lucide-react';

interface ResultToastProps {
  phase: string;
  txHash: string | null;
  error: string | null;
  onDismiss: () => void;
}

const isMainnet = (process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE ?? '').includes('Public Global');
const explorerNetwork = isMainnet ? 'public' : 'testnet';

export function ResultToast({ phase, txHash, error, onDismiss }: ResultToastProps) {
  const isSuccess = phase === 'success' && !!txHash;
  const isError = phase === 'error';

  return (
    <AnimatePresence>
      {(isSuccess || isError) && (
        <div className="fixed bottom-4 left-0 right-0 z-50 flex justify-center px-4 pointer-events-none">
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            className={`pointer-events-auto w-full max-w-md rounded-lg border shadow-lg bg-card p-4 flex items-start gap-3 ${
              isSuccess ? 'border-success/30' : 'border-destructive/30'
            }`}
          >
            <div className="shrink-0 mt-0.5">
              {isSuccess ? (
                <CheckCircle2 size={20} className="text-success" />
              ) : (
                <AlertCircle size={20} className="text-destructive" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">
                {isSuccess ? 'Transaction Confirmed' : 'Execution Failed'}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                {isSuccess
                  ? `Successfully broadcast on Stellar ${explorerNetwork}.`
                  : error || 'An unexpected error occurred.'}
              </p>
              {isSuccess && txHash && (
                <a
                  href={`https://stellar.expert/explorer/${explorerNetwork}/tx/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-success hover:underline mt-1.5"
                >
                  <ExternalLink size={12} />
                  View on Explorer
                </a>
              )}
            </div>

            <button
              onClick={onDismiss}
              className="p-1 rounded-md hover:bg-accent text-muted-foreground shrink-0"
            >
              <X size={16} />
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

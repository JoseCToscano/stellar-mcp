'use client';

// src/components/TransactionModal.tsx
//
// Modal: previews transaction params + XDR before user confirms & signs.

import { motion, AnimatePresence } from 'framer-motion';
import { XdrViewer } from './XdrViewer';

interface TransactionModalProps {
  open: boolean;
  toolName: string | null;
  args: Record<string, unknown> | null;
  xdr: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export function TransactionModal({
  open,
  toolName,
  args,
  xdr,
  onConfirm,
  onCancel,
}: TransactionModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onCancel}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
          />

          {/* Modal */}
          <motion.div
            key="modal"
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: 'spring', duration: 0.3 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
          >
            <div className="w-full max-w-md rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-2xl p-6 space-y-5 pointer-events-auto">
              {/* Header */}
              <div className="space-y-1">
                <h2 className="font-semibold text-lg">Confirm Transaction</h2>
                {toolName && (
                  <p className="text-sm text-[hsl(var(--muted-foreground))]">
                    Tool:{' '}
                    <code className="font-mono text-xs bg-[hsl(var(--muted))] px-1.5 py-0.5 rounded">
                      {toolName}
                    </code>
                  </p>
                )}
              </div>

              {/* Args summary */}
              {args && Object.keys(args).length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                    Parameters
                  </h3>
                  <div className="rounded-lg bg-[hsl(var(--muted))] p-3 space-y-1.5 max-h-40 overflow-y-auto">
                    {flattenArgs(args).map(([key, val]) => (
                      <div key={key} className="flex items-start gap-2 text-sm">
                        <span className="text-[hsl(var(--muted-foreground))] font-mono text-xs min-w-[80px] shrink-0">
                          {key}
                        </span>
                        <span className="font-mono text-xs break-all">{formatVal(val)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* XDR viewer */}
              {xdr && <XdrViewer xdr={xdr} />}

              {/* Warning */}
              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                Your browser will prompt for biometric authentication. This transaction will be
                submitted to Stellar via Launchtube.
              </p>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={onCancel}
                  className="flex-1 px-4 py-2.5 text-sm rounded-lg border border-[hsl(var(--border))] hover:bg-[hsl(var(--accent))] transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={onConfirm}
                  className="flex-1 px-4 py-2.5 text-sm font-medium rounded-lg bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:opacity-90 transition-opacity"
                >
                  Confirm & Sign
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function flattenArgs(
  args: Record<string, unknown>,
  prefix = '',
): [string, unknown][] {
  const entries: [string, unknown][] = [];
  for (const [k, v] of Object.entries(args)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      entries.push(...flattenArgs(v as Record<string, unknown>, key));
    } else {
      entries.push([key, v]);
    }
  }
  return entries;
}

function formatVal(v: unknown): string {
  if (v === null) return 'null';
  if (typeof v === 'string') return v.length > 40 ? `${v.slice(0, 40)}…` : v;
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

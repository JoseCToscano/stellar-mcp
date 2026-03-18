'use client';

import { motion } from 'framer-motion';
import { AlertCircle, Check, X, Zap } from 'lucide-react';
import { Button } from './ui/Button';

interface TransactionModalProps {
  open: boolean;
  toolName: string | null;
  args: Record<string, unknown> | null;
  xdr: string | null;
  simulationFee?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Convert a stroops string to a human-readable XLM amount */
function stroopsToXlm(stroops: string): string {
  const n = parseInt(stroops, 10);
  if (isNaN(n)) return stroops;
  const xlm = n / 10_000_000;
  // Show up to 7 decimal places, strip trailing zeros
  return xlm.toFixed(7).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '') + ' XLM';
}

export function TransactionModal({
  open,
  toolName,
  args,
  xdr: _xdr,
  simulationFee,
  onConfirm,
  onCancel,
}: TransactionModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        onClick={onCancel}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative w-full max-w-md bg-card border rounded-lg shadow-lg overflow-hidden"
      >
        <div className="p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Confirm Transaction</h2>
            <Button variant="ghost" size="icon" onClick={onCancel}>
              <X size={18} />
            </Button>
          </div>

          <div className="space-y-3">
            <div className="p-3 rounded-md bg-secondary">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Operation</p>
              <p className="font-medium">{toolName}</p>
            </div>

            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">Arguments</p>
              <div className="p-3 rounded-md bg-secondary font-mono text-xs max-h-32 overflow-y-auto">
                {args && Object.keys(args).length > 0 ? (
                  <pre className="whitespace-pre-wrap">{JSON.stringify(args, null, 2)}</pre>
                ) : (
                  <span className="text-muted-foreground italic">No arguments</span>
                )}
              </div>
            </div>

            {/* Simulation result — estimated fee from client.simulate() */}
            {simulationFee != null ? (
              <div className="flex items-center justify-between p-3 rounded-md bg-emerald-500/10 border border-emerald-500/20">
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                  <Zap size={14} className="shrink-0" />
                  <span className="text-xs font-medium">Estimated Fee</span>
                </div>
                <span className="font-mono text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                  {stroopsToXlm(simulationFee)}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 p-3 rounded-md bg-muted/50 text-muted-foreground text-xs">
                <Zap size={14} className="shrink-0" />
                <span>Fee sponsored by OZ Relayer — no XLM required</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-xs font-medium">
            <AlertCircle size={16} className="shrink-0" />
            <p>This action modifies the Stellar blockchain and requires your signature.</p>
          </div>

          <div className="flex gap-3">
            <Button variant="outline" onClick={onCancel} className="flex-1">
              Cancel
            </Button>
            <Button onClick={onConfirm} className="flex-1 gap-2">
              <Check size={16} />
              Sign & Confirm
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

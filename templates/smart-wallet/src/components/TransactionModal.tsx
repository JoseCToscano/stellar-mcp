'use client';

import { motion } from 'framer-motion';
import { AlertCircle, Check, X } from 'lucide-react';
import { Button } from './ui/Button';

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

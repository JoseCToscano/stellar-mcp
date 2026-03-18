'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Fingerprint, Send, Loader2 } from 'lucide-react';

interface SigningOverlayProps {
  phase: 'signing' | 'submitting' | null;
}

export function SigningOverlay({ phase }: SigningOverlayProps) {
  return (
    <AnimatePresence>
      {phase && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm px-4"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="text-center space-y-4"
          >
            <div className="mx-auto w-16 h-16 rounded-lg bg-secondary flex items-center justify-center">
              {phase === 'signing' ? (
                <Fingerprint size={32} className="text-foreground" />
              ) : (
                <Send size={32} className="text-foreground" />
              )}
            </div>

            <div>
              <h2 className="text-lg font-semibold">
                {phase === 'signing' ? 'Authorize Action' : 'Broadcasting'}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                {phase === 'signing'
                  ? 'Confirm with your biometric or security key.'
                  : 'Sending your transaction to the Stellar network.'}
              </p>
            </div>

            <Loader2 size={20} className="animate-spin mx-auto text-muted-foreground" />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

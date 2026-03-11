'use client';

// src/components/SigningOverlay.tsx
//
// Full-screen overlay shown while awaiting passkey authentication or tx submission.

import { motion, AnimatePresence } from 'framer-motion';

interface SigningOverlayProps {
  phase: 'signing' | 'submitting' | null;
}

export function SigningOverlay({ phase }: SigningOverlayProps) {
  const open = phase === 'signing' || phase === 'submitting';

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="signing-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', duration: 0.4 }}
            className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-8 flex flex-col items-center gap-5 shadow-2xl max-w-xs w-full mx-4"
          >
            {phase === 'signing' ? (
              <>
                {/* Fingerprint icon animation */}
                <motion.div
                  animate={{ scale: [1, 1.08, 1] }}
                  transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
                  className="w-16 h-16 rounded-full bg-[hsl(var(--primary))]/10 flex items-center justify-center text-3xl"
                >
                  ☝
                </motion.div>
                <div className="text-center">
                  <p className="font-semibold">Awaiting passkey…</p>
                  <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
                    Authenticate with Touch ID, Face ID, or your hardware key
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="w-12 h-12 border-4 border-[hsl(var(--primary))] border-t-transparent rounded-full animate-spin" />
                <div className="text-center">
                  <p className="font-semibold">Submitting…</p>
                  <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
                    Sending transaction to Stellar via Launchtube
                  </p>
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

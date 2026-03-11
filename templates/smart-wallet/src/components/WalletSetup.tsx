'use client';

// src/components/WalletSetup.tsx
//
// Full-screen wallet setup: Create new passkey wallet OR connect existing.

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { WalletState } from '@/hooks/useWallet';

interface WalletSetupProps {
  wallet: WalletState;
}

type Step = 'choose' | 'create' | 'connecting';

export function WalletSetup({ wallet }: WalletSetupProps) {
  const [step, setStep] = useState<Step>('choose');
  const [username, setUsername] = useState('');

  const handleCreate = async () => {
    if (!username.trim()) return;
    setStep('connecting');
    try {
      await wallet.createWallet(username.trim());
    } catch {
      setStep('create');
    }
  };

  const handleConnect = async () => {
    setStep('connecting');
    try {
      await wallet.connectWallet();
    } catch {
      setStep('choose');
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[hsl(var(--background))] px-4">
      {/* Logo / brand */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-10 text-center"
      >
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-stellar-blue to-stellar-purple mx-auto mb-4 flex items-center justify-center text-white text-2xl font-bold shadow-lg">
          S
        </div>
        <h1 className="text-2xl font-bold">Stellar MCP Wallet</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
          Passkey-powered smart wallet — no seed phrases, no extensions
        </p>
      </motion.div>

      <AnimatePresence mode="wait">
        {/* Connecting spinner */}
        {step === 'connecting' && (
          <motion.div
            key="connecting"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="text-center space-y-4"
          >
            <div className="w-12 h-12 border-4 border-[hsl(var(--primary))] border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-[hsl(var(--muted-foreground))]">
              {wallet.isConnecting ? 'Setting up your wallet…' : 'Awaiting passkey…'}
            </p>
          </motion.div>
        )}

        {/* Create wallet form */}
        {step === 'create' && (
          <motion.div
            key="create"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="w-full max-w-sm space-y-4"
          >
            <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 space-y-4">
              <h2 className="font-semibold text-lg">Create New Wallet</h2>
              <p className="text-sm text-[hsl(var(--muted-foreground))]">
                Choose a username for your passkey. Your browser will prompt you to register a
                biometric credential.
              </p>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                placeholder="e.g. alice"
                className="w-full px-3 py-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
                autoFocus
              />
              {wallet.error && (
                <p className="text-xs text-[hsl(var(--destructive))]">{wallet.error}</p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => setStep('choose')}
                  className="flex-1 px-4 py-2 text-sm rounded-lg border border-[hsl(var(--border))] hover:bg-[hsl(var(--accent))] transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleCreate}
                  disabled={!username.trim()}
                  className="flex-1 px-4 py-2 text-sm font-medium rounded-lg bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                >
                  Create
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Choose mode */}
        {step === 'choose' && (
          <motion.div
            key="choose"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            className="w-full max-w-sm space-y-3"
          >
            {wallet.error && (
              <div className="rounded-lg border border-[hsl(var(--destructive))]/30 bg-[hsl(var(--destructive))]/10 px-4 py-3 text-sm text-[hsl(var(--destructive))]">
                {wallet.error}
              </div>
            )}

            {/* Create card */}
            <button
              onClick={() => setStep('create')}
              className="w-full rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 text-left hover:border-[hsl(var(--primary))]/60 hover:bg-[hsl(var(--accent))] transition-all group"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-[hsl(var(--primary))]/10 flex items-center justify-center text-xl shrink-0 group-hover:bg-[hsl(var(--primary))]/20 transition-colors">
                  ✦
                </div>
                <div>
                  <h2 className="font-semibold">Create New Wallet</h2>
                  <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
                    Register a new passkey and deploy a smart wallet contract on Stellar
                  </p>
                </div>
              </div>
            </button>

            {/* Connect card */}
            <button
              onClick={handleConnect}
              className="w-full rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 text-left hover:border-[hsl(var(--primary))]/60 hover:bg-[hsl(var(--accent))] transition-all group"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-[hsl(var(--primary))]/10 flex items-center justify-center text-xl shrink-0 group-hover:bg-[hsl(var(--primary))]/20 transition-colors">
                  ⚙
                </div>
                <div>
                  <h2 className="font-semibold">Connect Existing Wallet</h2>
                  <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
                    Authenticate with your existing passkey to restore access
                  </p>
                </div>
              </div>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

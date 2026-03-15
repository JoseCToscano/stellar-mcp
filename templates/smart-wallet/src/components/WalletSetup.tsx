'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PlusCircle, LogIn, Loader2 } from 'lucide-react';
import type { WalletState } from '@/hooks/useWallet';
import { Button } from './ui/Button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/Card';
import { Input } from './ui/Input';

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
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-10 text-center"
      >
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Stellar Smart Wallet</h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto">
          Passkey-powered smart accounts for the Stellar network.
        </p>
      </motion.div>

      <AnimatePresence mode="wait">
        {step === 'connecting' && (
          <motion.div
            key="connecting"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-center space-y-4 flex flex-col items-center"
          >
            <Loader2 size={32} className="animate-spin text-muted-foreground" />
            <div className="space-y-1">
              <p className="text-sm font-medium">
                {wallet.isConnecting ? 'Setting up your wallet…' : 'Awaiting authentication…'}
              </p>
              <p className="text-xs text-muted-foreground">
                Follow the prompts in your browser
              </p>
            </div>
          </motion.div>
        )}

        {step === 'create' && (
          <motion.div
            key="create"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            className="w-full max-w-sm"
          >
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Create New Wallet</CardTitle>
                <CardDescription>
                  Choose a username for your passkey credential.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="username" className="text-sm font-medium">Username</label>
                  <Input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                    placeholder="e.g. alice"
                    autoFocus
                  />
                </div>

                {wallet.error && (
                  <p className="text-sm text-destructive">{wallet.error}</p>
                )}

                <div className="flex gap-3 pt-2">
                  <Button variant="outline" onClick={() => setStep('choose')} className="flex-1">
                    Back
                  </Button>
                  <Button
                    onClick={handleCreate}
                    disabled={!username.trim() || wallet.isConnecting}
                    className="flex-1 gap-2"
                  >
                    {wallet.isConnecting && <Loader2 size={16} className="animate-spin" />}
                    Create
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {step === 'choose' && (
          <motion.div
            key="choose"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="w-full max-w-sm space-y-3"
          >
            {wallet.error && (
              <p className="text-sm text-destructive text-center">{wallet.error}</p>
            )}

            <Card
              className="cursor-pointer transition-all hover:border-foreground"
              onClick={() => setStep('create')}
            >
              <CardContent className="p-5 flex items-center gap-4">
                <PlusCircle size={20} className="text-muted-foreground shrink-0" />
                <div>
                  <h2 className="font-medium text-sm">Create New Wallet</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Deploy a smart account using your device biometrics.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card
              className="cursor-pointer transition-all hover:border-foreground"
              onClick={handleConnect}
            >
              <CardContent className="p-5 flex items-center gap-4">
                <LogIn size={20} className="text-muted-foreground shrink-0" />
                <div>
                  <h2 className="font-medium text-sm">Connect Existing</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Sign in with your existing passkey.
                  </p>
                </div>
              </CardContent>
            </Card>

            <p className="text-center text-[10px] text-muted-foreground font-medium uppercase tracking-widest pt-4">
              Powered by PasskeyKit
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WifiOff, Loader2, RefreshCw } from 'lucide-react';
import { useWallet } from '@/hooks/useWallet';
import { useMCP } from '@/hooks/useMCP';
import { useTransaction } from '@/hooks/useTransaction';
import { WalletSetup } from '@/components/WalletSetup';
import { Header } from '@/components/Header';
import { ToolBrowser } from '@/components/ToolBrowser';
import { TransactionModal } from '@/components/TransactionModal';
import { SigningOverlay } from '@/components/SigningOverlay';
import { ResultToast } from '@/components/ResultToast';
import { Button } from '@/components/ui/Button';

export default function Page() {
  const wallet = useWallet();
  const mcp = useMCP();
  const tx = useTransaction();

  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'));
  }, []);

  const toggleTheme = useCallback(() => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('sw:theme', next ? 'dark' : 'light');
  }, [isDark]);

  const [lastReadTool, setLastReadTool] = useState<string | null>(null);

  const handleExecute = useCallback(
    (toolName: string, args: Record<string, unknown>) => {
      if (!wallet.contractId) return;
      setLastReadTool(toolName);
      tx.execute(toolName, args, wallet.contractId);
    },
    [tx, wallet.contractId],
  );

  const handleConfirm = useCallback(() => {
    if (!wallet.keyId) return;
    tx.confirm(wallet.keyId);
  }, [tx, wallet.keyId]);

  const handleToastDismiss = useCallback(() => {
    tx.reset();
    setLastReadTool(null);
  }, [tx]);

  if (!wallet.contractId) {
    return <WalletSetup wallet={wallet} />;
  }

  const isExecuting =
    tx.phase === 'simulating' || tx.phase === 'signing' || tx.phase === 'submitting';

  return (
    <div className="min-h-screen bg-background">
      <Header
        contractId={wallet.contractId}
        onDisconnect={wallet.disconnect}
        isDark={isDark}
        onToggleTheme={toggleTheme}
      />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <AnimatePresence mode="wait">
          {mcp.error ? (
            <motion.div
              key="mcp-error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="rounded-lg border border-destructive/20 bg-destructive/5 p-6 text-center space-y-3"
            >
              <WifiOff size={24} className="mx-auto text-destructive" />
              <div>
                <h2 className="text-lg font-semibold">Connection Failed</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Could not connect to the Stellar MCP server.
                </p>
              </div>
              <pre className="p-3 rounded-md bg-secondary text-xs font-mono text-left overflow-x-auto max-w-md mx-auto">
                {mcp.error}
              </pre>
              <Button onClick={mcp.refresh} variant="outline" className="gap-2">
                <RefreshCw size={14} />
                Retry
              </Button>
            </motion.div>
          ) : mcp.loading ? (
            <motion.div
              key="mcp-loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-20 space-y-3"
            >
              <Loader2 size={24} className="animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Loading tools...</p>
            </motion.div>
          ) : (
            <motion.div
              key="mcp-ready"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="mb-6">
                <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Interact with your smart contract via MCP.
                </p>
              </div>

              <ToolBrowser
                tools={mcp.tools}
                contractId={wallet.contractId}
                onExecute={handleExecute}
                isExecuting={isExecuting}
                readResult={tx.readResult}
                lastReadTool={lastReadTool}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <TransactionModal
        open={tx.phase === 'previewing'}
        toolName={tx.pendingToolName}
        args={tx.pendingArgs}
        xdr={tx.pendingXdr}
        onConfirm={handleConfirm}
        onCancel={tx.cancel}
      />

      <SigningOverlay
        phase={
          tx.phase === 'signing' || tx.phase === 'submitting' ? tx.phase : null
        }
      />

      <ResultToast
        phase={tx.phase}
        txHash={tx.txHash}
        error={tx.error}
        onDismiss={handleToastDismiss}
      />
    </div>
  );
}

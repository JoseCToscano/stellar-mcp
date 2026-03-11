'use client';

// src/app/page.tsx
//
// Entrypoint: renders WalletSetup if no wallet connected, Dashboard otherwise.

import { useState, useEffect, useCallback } from 'react';
import { useWallet } from '@/hooks/useWallet';
import { useMCP } from '@/hooks/useMCP';
import { useTransaction } from '@/hooks/useTransaction';
import { WalletSetup } from '@/components/WalletSetup';
import { Header } from '@/components/Header';
import { ToolBrowser } from '@/components/ToolBrowser';
import { TransactionModal } from '@/components/TransactionModal';
import { SigningOverlay } from '@/components/SigningOverlay';
import { ResultToast } from '@/components/ResultToast';

export default function Page() {
  const wallet = useWallet();
  const mcp = useMCP();
  const tx = useTransaction();

  // Dark mode state (synced with document root class)
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    // Read initial state from class applied by ThemeScript
    setIsDark(document.documentElement.classList.contains('dark'));
  }, []);

  const toggleTheme = useCallback(() => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('sw:theme', next ? 'dark' : 'light');
  }, [isDark]);

  // Track last read tool for result display
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

  // No wallet → setup screen
  if (!wallet.contractId) {
    return <WalletSetup wallet={wallet} />;
  }

  const isExecuting =
    tx.phase === 'simulating' || tx.phase === 'signing' || tx.phase === 'submitting';

  return (
    <>
      <Header
        contractId={wallet.contractId}
        onDisconnect={wallet.disconnect}
        isDark={isDark}
        onToggleTheme={toggleTheme}
      />

      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* MCP server status */}
        {mcp.error ? (
          <div className="rounded-xl border border-[hsl(var(--destructive))]/30 bg-[hsl(var(--destructive))]/10 px-5 py-4 text-sm text-[hsl(var(--destructive))] mb-6">
            <strong>Could not connect to MCP server.</strong>
            <br />
            {mcp.error}
            <br />
            Make sure <code className="font-mono text-xs">NEXT_PUBLIC_MCP_SERVER_URL</code> is set
            correctly and the server is running.
            <button
              onClick={mcp.refresh}
              className="ml-4 underline hover:no-underline"
            >
              Retry
            </button>
          </div>
        ) : mcp.loading ? (
          <div className="flex items-center gap-3 text-sm text-[hsl(var(--muted-foreground))] mb-6">
            <div className="w-4 h-4 border-2 border-[hsl(var(--primary))] border-t-transparent rounded-full animate-spin" />
            Connecting to MCP server…
          </div>
        ) : null}

        {!mcp.loading && !mcp.error && (
          <ToolBrowser
            tools={mcp.tools}
            contractId={wallet.contractId}
            onExecute={handleExecute}
            isExecuting={isExecuting}
            readResult={tx.readResult}
            lastReadTool={lastReadTool}
          />
        )}
      </main>

      {/* Transaction preview modal */}
      <TransactionModal
        open={tx.phase === 'previewing'}
        toolName={tx.pendingToolName}
        args={tx.pendingArgs}
        xdr={tx.pendingXdr}
        onConfirm={handleConfirm}
        onCancel={tx.cancel}
      />

      {/* Passkey / submitting overlay */}
      <SigningOverlay
        phase={
          tx.phase === 'signing' || tx.phase === 'submitting' ? tx.phase : null
        }
      />

      {/* Result toast */}
      <ResultToast
        phase={tx.phase}
        txHash={tx.txHash}
        error={tx.error}
        onDismiss={handleToastDismiss}
      />
    </>
  );
}

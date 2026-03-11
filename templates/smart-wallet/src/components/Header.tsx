'use client';

// src/components/Header.tsx
//
// App header: wallet address pill + disconnect + dark mode toggle.

import { useCallback, useState } from 'react';

interface HeaderProps {
  contractId: string;
  onDisconnect: () => void;
  isDark: boolean;
  onToggleTheme: () => void;
}

function truncate(addr: string): string {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-6)}`;
}

export function Header({ contractId, onDisconnect, isDark, onToggleTheme }: HeaderProps) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async () => {
    await navigator.clipboard.writeText(contractId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [contractId]);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-[hsl(var(--border))] bg-[hsl(var(--background))]/80 backdrop-blur-sm">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
        {/* Brand */}
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-stellar-blue to-stellar-purple flex items-center justify-center text-white text-xs font-bold">
            S
          </div>
          <span className="font-semibold text-sm hidden sm:block">Stellar MCP Wallet</span>
        </div>

        {/* Wallet pill */}
        <button
          onClick={copy}
          title="Click to copy address"
          className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[hsl(var(--muted))] hover:bg-[hsl(var(--accent))] transition-colors text-xs font-mono"
        >
          <span className="w-2 h-2 rounded-full bg-green-400 shrink-0" />
          <span>{truncate(contractId)}</span>
          <span className="text-[hsl(var(--muted-foreground))]">{copied ? '✓' : '⎘'}</span>
        </button>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={onToggleTheme}
            className="p-2 rounded-lg hover:bg-[hsl(var(--accent))] transition-colors text-[hsl(var(--muted-foreground))]"
            aria-label="Toggle theme"
          >
            {isDark ? '☀️' : '🌙'}
          </button>
          <button
            onClick={onDisconnect}
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-[hsl(var(--border))] hover:bg-[hsl(var(--destructive))] hover:text-[hsl(var(--destructive-foreground))] hover:border-transparent transition-colors"
          >
            Disconnect
          </button>
        </div>
      </div>
    </header>
  );
}

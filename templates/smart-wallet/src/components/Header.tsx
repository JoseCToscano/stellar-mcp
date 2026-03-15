'use client';

import { useCallback, useState } from 'react';
import { Copy, Check, LogOut, Sun, Moon } from 'lucide-react';
import { Button } from './ui/Button';

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
    <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur-sm">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <span className="font-semibold text-sm tracking-tight">Stellar Smart Wallet</span>
          <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Testnet</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={copy}
            title="Copy address"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-secondary hover:bg-accent transition-colors text-xs font-mono"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-success shrink-0" />
            <span>{truncate(contractId)}</span>
            {copied ? <Check size={12} /> : <Copy size={12} className="text-muted-foreground" />}
          </button>

          <Button variant="ghost" size="icon" onClick={onToggleTheme} aria-label="Toggle theme">
            {isDark ? <Sun size={16} /> : <Moon size={16} />}
          </Button>

          <Button variant="ghost" size="icon" onClick={onDisconnect} aria-label="Disconnect">
            <LogOut size={16} />
          </Button>
        </div>
      </div>
    </header>
  );
}

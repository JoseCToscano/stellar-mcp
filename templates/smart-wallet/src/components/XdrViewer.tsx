'use client';

// src/components/XdrViewer.tsx
//
// Collapsible XDR display with copy-to-clipboard button.

import { useState, useCallback } from 'react';

interface XdrViewerProps {
  xdr: string;
}

export function XdrViewer({ xdr }: XdrViewerProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async () => {
    await navigator.clipboard.writeText(xdr);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [xdr]);

  return (
    <div className="rounded-lg border border-[hsl(var(--border))] overflow-hidden text-sm font-mono">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3 py-2 bg-[hsl(var(--muted))] hover:bg-[hsl(var(--accent))] transition-colors text-[hsl(var(--muted-foreground))]"
      >
        <span className="font-semibold text-xs tracking-wide uppercase">XDR Transaction</span>
        <span className="text-xs">{open ? '▲ Hide' : '▼ Show'}</span>
      </button>

      {open && (
        <div className="relative">
          <pre className="p-3 text-xs overflow-x-auto whitespace-pre-wrap break-all bg-[hsl(var(--card))] text-[hsl(var(--foreground))] max-h-40">
            {xdr}
          </pre>
          <button
            onClick={copy}
            className="absolute top-2 right-2 px-2 py-1 text-xs rounded bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:opacity-90 transition-opacity"
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      )}
    </div>
  );
}

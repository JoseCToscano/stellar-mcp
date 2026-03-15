'use client';

import { useState, useCallback } from 'react';
import { ChevronDown, ChevronUp, Copy, Check } from 'lucide-react';

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
    <div className="rounded-md border overflow-hidden text-sm font-mono">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3 py-2 bg-secondary hover:bg-accent transition-colors text-muted-foreground"
      >
        <span className="font-medium text-xs uppercase tracking-wider">XDR</span>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {open && (
        <div className="relative">
          <pre className="p-3 text-xs overflow-x-auto whitespace-pre-wrap break-all bg-card max-h-40">
            {xdr}
          </pre>
          <button
            onClick={copy}
            className="absolute top-2 right-2 p-1.5 rounded-md bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
          </button>
        </div>
      )}
    </div>
  );
}

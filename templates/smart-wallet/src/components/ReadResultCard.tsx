'use client';

import { useState } from 'react';
import { CheckCircle2, Copy, Check } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { Button } from './ui/Button';

interface ReadResultCardProps {
  result: unknown;
  toolName: string;
}

export function ReadResultCard({ result, toolName }: ReadResultCardProps) {
  const [copied, setCopied] = useState(false);

  const formatted =
    typeof result === 'object' ? JSON.stringify(result, null, 2) : String(result);

  const copy = async () => {
    await navigator.clipboard.writeText(formatted);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center gap-2">
          <CheckCircle2 size={16} className="text-success" />
          <div>
            <CardTitle className="text-sm font-medium">Result</CardTitle>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{toolName}</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={copy} className="h-7 gap-1.5 text-xs">
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </CardHeader>
      <CardContent>
        <pre className="p-3 rounded-md bg-secondary text-xs font-mono overflow-x-auto max-h-64">
          <code>{formatted}</code>
        </pre>
      </CardContent>
    </Card>
  );
}

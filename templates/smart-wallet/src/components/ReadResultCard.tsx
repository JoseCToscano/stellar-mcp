'use client';

// src/components/ReadResultCard.tsx
//
// Renders arbitrary read results (primitives, arrays, objects).

interface ReadResultCardProps {
  result: unknown;
  toolName: string;
}

function renderValue(value: unknown, depth = 0): React.ReactNode {
  if (value === null) return <span className="text-[hsl(var(--muted-foreground))] italic">null</span>;
  if (value === undefined) return <span className="text-[hsl(var(--muted-foreground))] italic">undefined</span>;

  if (typeof value === 'boolean') {
    return (
      <span className={value ? 'text-green-500' : 'text-red-400'}>
        {value.toString()}
      </span>
    );
  }

  if (typeof value === 'number' || typeof value === 'bigint') {
    return <span className="text-[hsl(var(--primary))]">{value.toString()}</span>;
  }

  if (typeof value === 'string') {
    // Stellar address — monospace
    if (/^[GC][A-Z0-9]{54}$/.test(value)) {
      return (
        <span className="font-mono text-xs bg-[hsl(var(--muted))] px-1 rounded">{value}</span>
      );
    }
    return <span className="text-[hsl(var(--foreground))]">{value}</span>;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <span className="text-[hsl(var(--muted-foreground))] italic">[]</span>;
    }
    return (
      <ul className={`list-none ${depth > 0 ? 'ml-4' : ''} space-y-1`}>
        {value.map((item, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className="text-[hsl(var(--muted-foreground))] text-xs mt-0.5">{i}.</span>
            <span>{renderValue(item, depth + 1)}</span>
          </li>
        ))}
      </ul>
    );
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) {
      return <span className="text-[hsl(var(--muted-foreground))] italic">{'{}'}</span>;
    }
    return (
      <dl className={`${depth > 0 ? 'ml-4' : ''} space-y-1`}>
        {entries.map(([k, v]) => (
          <div key={k} className="flex items-start gap-2">
            <dt className="text-[hsl(var(--muted-foreground))] text-xs font-medium min-w-[80px] shrink-0">
              {k}
            </dt>
            <dd>{renderValue(v, depth + 1)}</dd>
          </div>
        ))}
      </dl>
    );
  }

  return <span>{String(value)}</span>;
}

export function ReadResultCard({ result, toolName }: ReadResultCardProps) {
  return (
    <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-green-400 shrink-0" />
        <h3 className="font-semibold text-sm">{toolName}</h3>
        <span className="text-xs text-[hsl(var(--muted-foreground))] ml-auto">Result</span>
      </div>
      <div className="text-sm overflow-auto max-h-64">{renderValue(result)}</div>
    </div>
  );
}

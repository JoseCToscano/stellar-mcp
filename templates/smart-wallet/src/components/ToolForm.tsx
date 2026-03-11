'use client';

// src/components/ToolForm.tsx
//
// Renders a form for a selected tool based on its ArgDef list.
// Calls useTransaction().execute() on submit.

import { useState, useCallback } from 'react';
import type { ToolInfo } from '@stellar-mcp/client';
import { extractArgs, buildToolArgs, parseArgValue, type ArgDef } from '@/lib/schema';

interface ToolFormProps {
  tool: ToolInfo;
  contractId: string;
  onExecute: (toolName: string, args: Record<string, unknown>) => void;
  isLoading: boolean;
}

function argKey(arg: ArgDef): string {
  return arg.path.join('.');
}

const ADDRESS_ARG_RE = /^(deployer|from|source|wallet|account|admin|sender|owner)$/i;

export function ToolForm({ tool, contractId, onExecute, isLoading }: ToolFormProps) {
  const args = extractArgs(tool);

  // Pre-fill known address args with the connected wallet contractId
  const [collected, setCollected] = useState<Record<string, unknown>>(() => {
    const init: Record<string, unknown> = {};
    for (const arg of args) {
      if (ADDRESS_ARG_RE.test(arg.name)) {
        init[argKey(arg)] = contractId;
      }
    }
    return init;
  });

  const setValue = useCallback((arg: ArgDef, rawValue: unknown) => {
    const key = argKey(arg);
    setCollected((prev) => {
      if (rawValue === '' && !arg.required) {
        const next = { ...prev };
        delete next[key];
        return next;
      }
      return { ...prev, [key]: rawValue };
    });
  }, []);

  const isComplete = args
    .filter((a) => a.required)
    .every((a) => Object.prototype.hasOwnProperty.call(collected, argKey(a)));

  const handleSubmit = useCallback(() => {
    const builtArgs = buildToolArgs(args, collected);
    onExecute(tool.name, builtArgs);
  }, [args, collected, onExecute, tool.name]);

  if (args.length === 0) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          This tool takes no parameters.
        </p>
        <button
          onClick={() => onExecute(tool.name, {})}
          disabled={isLoading}
          className="w-full px-4 py-2 text-sm font-medium rounded-lg bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
        >
          {isLoading ? 'Running…' : 'Execute'}
        </button>
      </div>
    );
  }

  // Group args by their group
  const grouped: { group: string | undefined; items: ArgDef[] }[] = [];
  for (const arg of args) {
    const last = grouped[grouped.length - 1];
    if (last && last.group === arg.group) {
      last.items.push(arg);
    } else {
      grouped.push({ group: arg.group, items: [arg] });
    }
  }

  return (
    <div className="space-y-5">
      {grouped.map(({ group, items }) => (
        <div key={group ?? '__top__'}>
          {group && (
            <h4 className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))] mb-3">
              {group}
            </h4>
          )}
          <div className="space-y-3">
            {items.map((arg) => (
              <ArgInput
                key={argKey(arg)}
                arg={arg}
                value={collected[argKey(arg)]}
                contractId={contractId}
                onChange={(v) => setValue(arg, v)}
              />
            ))}
          </div>
        </div>
      ))}

      <button
        onClick={handleSubmit}
        disabled={!isComplete || isLoading}
        className="w-full px-4 py-2.5 text-sm font-medium rounded-lg bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
      >
        {isLoading ? 'Running…' : 'Execute'}
      </button>
    </div>
  );
}

// ─── ArgInput ──────────────────────────────────────────────────────────────────

interface ArgInputProps {
  arg: ArgDef;
  value: unknown;
  contractId: string;
  onChange: (value: unknown) => void;
}

function ArgInput({ arg, value, contractId, onChange }: ArgInputProps) {
  const label = (
    <div className="flex items-center justify-between mb-1">
      <label className="text-sm font-medium">
        {arg.name}
        {arg.required && <span className="text-[hsl(var(--destructive))] ml-0.5">*</span>}
      </label>
      {arg.nullable && (
        <span className="text-xs text-[hsl(var(--muted-foreground))]">(optional)</span>
      )}
    </div>
  );

  if (arg.description) {
    // show description as hint
  }

  // Enum / union tag → select
  if (arg.enum && arg.enum.length > 0) {
    return (
      <div>
        {label}
        <div className="flex flex-wrap gap-2">
          {arg.enum.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(opt)}
              className={`px-3 py-1 text-sm rounded-lg border transition-colors ${
                value === opt
                  ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] border-[hsl(var(--primary))]'
                  : 'border-[hsl(var(--border))] hover:border-[hsl(var(--primary))]/60'
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
        {arg.description && (
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">{arg.description}</p>
        )}
      </div>
    );
  }

  // Boolean → toggle
  if (arg.type === 'boolean') {
    return (
      <div className="flex items-center justify-between">
        <div>
          <span className="text-sm font-medium">{arg.name}</span>
          {arg.required && <span className="text-[hsl(var(--destructive))] ml-0.5">*</span>}
          {arg.description && (
            <p className="text-xs text-[hsl(var(--muted-foreground))]">{arg.description}</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => onChange(!value)}
          className={`relative w-10 h-6 rounded-full transition-colors ${
            value ? 'bg-[hsl(var(--primary))]' : 'bg-[hsl(var(--border))]'
          }`}
        >
          <span
            className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
              value ? 'translate-x-4' : 'translate-x-0'
            }`}
          />
        </button>
      </div>
    );
  }

  // Number / integer
  if (arg.type === 'number' || arg.type === 'integer') {
    return (
      <div>
        {label}
        <input
          type="number"
          value={value !== undefined && value !== null ? String(value) : ''}
          onChange={(e) => onChange(parseArgValue(e.target.value, arg))}
          placeholder={arg.description || arg.name}
          className="w-full px-3 py-2 text-sm rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
        />
      </div>
    );
  }

  // Object / array → JSON textarea
  if (arg.type === 'object' || arg.type === 'array') {
    return (
      <div>
        {label}
        <textarea
          value={value !== undefined ? JSON.stringify(value, null, 2) : ''}
          onChange={(e) => onChange(parseArgValue(e.target.value, arg))}
          placeholder={`JSON ${arg.type}…`}
          rows={3}
          className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] resize-y"
        />
        {arg.description && (
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">{arg.description}</p>
        )}
      </div>
    );
  }

  // Default: text input
  const isAddressArg = ADDRESS_ARG_RE.test(arg.name);

  return (
    <div>
      {label}
      <input
        type="text"
        value={value !== undefined && value !== null ? String(value) : ''}
        onChange={(e) => onChange(parseArgValue(e.target.value, arg))}
        placeholder={
          isAddressArg ? `${contractId} (your wallet)` : arg.description || arg.name
        }
        className="w-full px-3 py-2 text-sm rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] font-mono"
      />
      {arg.description && !isAddressArg && (
        <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">{arg.description}</p>
      )}
    </div>
  );
}

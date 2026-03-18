'use client';

import { useState, useCallback, useMemo } from 'react';
import { Play, Loader2 } from 'lucide-react';
import type { ToolInfo } from '@stellar-mcp/client';
import { extractArgs, buildToolArgs, parseArgValue, argKey, type ArgDef } from '@stellar-mcp/client';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Badge } from './ui/Badge';

interface ToolFormProps {
  tool: ToolInfo;
  contractId: string;
  onExecute: (toolName: string, args: Record<string, unknown>) => void;
  isLoading: boolean;
}

const ADDRESS_ARG_RE = /^(deployer|from|source|wallet|account|admin|sender|owner)$/i;

export function ToolForm({ tool, contractId, onExecute, isLoading }: ToolFormProps) {
  const args = useMemo(() => extractArgs(tool), [tool]);

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
        <p className="text-sm text-muted-foreground">This tool takes no parameters.</p>
        <Button
          onClick={() => onExecute(tool.name, {})}
          disabled={isLoading}
          className="w-full gap-2"
        >
          {isLoading ? (
            <><Loader2 size={16} className="animate-spin" /> Executing...</>
          ) : (
            <><Play size={14} fill="currentColor" /> Execute</>
          )}
        </Button>
      </div>
    );
  }

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
    <div className="space-y-6">
      {grouped.map(({ group, items }) => (
        <div key={group ?? '__top__'} className="space-y-4">
          {group && (
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b pb-2">
              {group}
            </h4>
          )}
          {items.map((arg) => (
            <ArgInput
              key={argKey(arg)}
              arg={arg}
              value={collected[argKey(arg)]}
              contractId={contractId}
              onChange={(v) => setValue(arg, v)}
              disabled={isLoading}
            />
          ))}
        </div>
      ))}

      <Button
        onClick={handleSubmit}
        disabled={!isComplete || isLoading}
        className="w-full gap-2"
        size="lg"
      >
        {isLoading ? (
          <><Loader2 size={16} className="animate-spin" /> Processing...</>
        ) : (
          <><Play size={14} fill="currentColor" /> Run {tool.name}</>
        )}
      </Button>
    </div>
  );
}

interface ArgInputProps {
  arg: ArgDef;
  value: unknown;
  contractId: string;
  onChange: (value: unknown) => void;
  disabled?: boolean;
}

function ArgInput({ arg, value, contractId, onChange, disabled }: ArgInputProps) {
  const isAddressArg = ADDRESS_ARG_RE.test(arg.name);

  const label = (
    <div className="flex items-center justify-between mb-1.5">
      <label className="text-sm font-medium">
        {arg.name}
        {arg.required && <span className="text-destructive ml-0.5">*</span>}
      </label>
      <div className="flex gap-1.5">
        {arg.nullable && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">optional</Badge>
        )}
        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{arg.type}</Badge>
      </div>
    </div>
  );

  if (arg.enum && arg.enum.length > 0) {
    return (
      <div>
        {label}
        <div className="flex flex-wrap gap-1.5">
          {arg.enum.map((opt) => (
            <button
              key={opt}
              type="button"
              disabled={disabled}
              onClick={() => onChange(opt)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${
                value === opt
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background border-input hover:bg-accent'
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
        {arg.description && (
          <p className="text-xs text-muted-foreground mt-1">{arg.description}</p>
        )}
      </div>
    );
  }

  if (arg.type === 'boolean') {
    return (
      <div className="flex items-center justify-between py-2">
        <div>
          <span className="text-sm font-medium">{arg.name}</span>
          {arg.description && (
            <p className="text-xs text-muted-foreground">{arg.description}</p>
          )}
        </div>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange(!value)}
          className={`relative w-10 h-6 rounded-full transition-colors ${
            value ? 'bg-primary' : 'bg-input'
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${
              value ? 'translate-x-4' : 'translate-x-0'
            }`}
          />
        </button>
      </div>
    );
  }

  if (arg.type === 'object' || arg.type === 'array') {
    return (
      <div>
        {label}
        <textarea
          value={value !== undefined ? JSON.stringify(value, null, 2) : ''}
          disabled={disabled}
          onChange={(e) => onChange(parseArgValue(e.target.value, arg))}
          placeholder={`Enter valid JSON ${arg.type}...`}
          rows={3}
          className="w-full px-3 py-2 text-xs font-mono rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none"
        />
        {arg.description && (
          <p className="text-xs text-muted-foreground mt-1">{arg.description}</p>
        )}
      </div>
    );
  }

  return (
    <div>
      {label}
      <Input
        type={arg.type === 'number' || arg.type === 'integer' ? 'number' : 'text'}
        value={value !== undefined && value !== null ? String(value) : ''}
        disabled={disabled}
        onChange={(e) => onChange(parseArgValue(e.target.value, arg))}
        placeholder={
          isAddressArg ? `${contractId.slice(0, 8)}... (Your Wallet)` : arg.description || `Enter ${arg.name}`
        }
        className={isAddressArg ? 'font-mono text-xs' : ''}
      />
      {arg.description && !isAddressArg && (
        <p className="text-xs text-muted-foreground mt-1">{arg.description}</p>
      )}
    </div>
  );
}

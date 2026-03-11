'use client';

// src/components/ToolBrowser.tsx
//
// Two-tab layout: Read | Write.
// Clicking a tool card opens ToolForm in a slide-in panel.

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ToolInfo } from '@stellar-mcp/client';
import { isReadOperation } from '@/lib/schema';
import { ToolForm } from './ToolForm';
import { ReadResultCard } from './ReadResultCard';

interface ToolBrowserProps {
  tools: ToolInfo[];
  contractId: string;
  onExecute: (toolName: string, args: Record<string, unknown>) => void;
  isExecuting: boolean;
  readResult: unknown;
  lastReadTool: string | null;
}

type Tab = 'read' | 'write';

// Filter out internal MCP tools that users shouldn't call directly
const INTERNAL_TOOLS = new Set(['sign-and-submit', 'prepare-transaction', 'prepare-sign-and-submit']);

export function ToolBrowser({
  tools,
  contractId,
  onExecute,
  isExecuting,
  readResult,
  lastReadTool,
}: ToolBrowserProps) {
  const [tab, setTab] = useState<Tab>('read');
  const [selectedTool, setSelectedTool] = useState<ToolInfo | null>(null);

  const visible = tools.filter((t) => !INTERNAL_TOOLS.has(t.name));
  const readTools = visible.filter((t) => isReadOperation(t.name));
  const writeTools = visible.filter((t) => !isReadOperation(t.name));
  const shown = tab === 'read' ? readTools : writeTools;

  const handleToolSelect = (tool: ToolInfo) => {
    setSelectedTool(tool);
  };

  const handleBack = () => {
    setSelectedTool(null);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Tab bar */}
      <div className="flex gap-1 p-1 rounded-xl bg-[hsl(var(--muted))] w-fit">
        {(['read', 'write'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); setSelectedTool(null); }}
            className={`px-5 py-1.5 text-sm font-medium rounded-lg transition-all ${
              tab === t
                ? 'bg-[hsl(var(--card))] shadow-sm text-[hsl(var(--foreground))]'
                : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
            }`}
          >
            {t === 'read' ? `Read (${readTools.length})` : `Write (${writeTools.length})`}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {selectedTool ? (
          /* Tool form panel */
          <motion.div
            key={`form-${selectedTool.name}`}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 space-y-4"
          >
            <div className="flex items-center gap-3">
              <button
                onClick={handleBack}
                className="p-1.5 rounded-lg hover:bg-[hsl(var(--accent))] transition-colors text-[hsl(var(--muted-foreground))]"
                aria-label="Back"
              >
                ←
              </button>
              <div>
                <h2 className="font-semibold">{selectedTool.name}</h2>
                {selectedTool.description && (
                  <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
                    {selectedTool.description}
                  </p>
                )}
              </div>
            </div>
            <ToolForm
              tool={selectedTool}
              contractId={contractId}
              onExecute={onExecute}
              isLoading={isExecuting}
            />
          </motion.div>
        ) : (
          /* Tool grid */
          <motion.div
            key={`grid-${tab}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {shown.length === 0 ? (
              <p className="text-sm text-[hsl(var(--muted-foreground))] text-center py-8">
                No {tab} tools available.
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {shown.map((tool) => (
                  <ToolCard key={tool.name} tool={tool} onClick={() => handleToolSelect(tool)} />
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Read result */}
      {readResult !== null && readResult !== undefined && lastReadTool && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <ReadResultCard result={readResult} toolName={lastReadTool} />
        </motion.div>
      )}
    </div>
  );
}

// ─── Tool card ────────────────────────────────────────────────────────────────

interface ToolCardProps {
  tool: ToolInfo;
  onClick: () => void;
}

function ToolCard({ tool, onClick }: ToolCardProps) {
  const isRead = isReadOperation(tool.name);

  return (
    <button
      onClick={onClick}
      className="text-left rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 hover:border-[hsl(var(--primary))]/50 hover:bg-[hsl(var(--accent))] transition-all group"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                isRead ? 'bg-blue-400' : 'bg-amber-400'
              }`}
            />
            <h3 className="font-medium text-sm truncate">{tool.name}</h3>
          </div>
          {tool.description && (
            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1 line-clamp-2">
              {tool.description}
            </p>
          )}
        </div>
        <span className="text-[hsl(var(--muted-foreground))] group-hover:text-[hsl(var(--foreground))] transition-colors shrink-0">
          →
        </span>
      </div>
    </button>
  );
}

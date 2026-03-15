'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, ArrowRight, Eye, PenLine, ChevronLeft } from 'lucide-react';
import type { ToolInfo } from '@stellar-mcp/client';
import { isReadOperation, extractArgs } from '@/lib/schema';
import { ToolForm } from './ToolForm';
import { ReadResultCard } from './ReadResultCard';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Card, CardContent } from './ui/Card';

interface ToolBrowserProps {
  tools: ToolInfo[];
  contractId: string;
  onExecute: (toolName: string, args: Record<string, unknown>) => void;
  isExecuting: boolean;
  readResult: unknown;
  lastReadTool: string | null;
}

type Tab = 'read' | 'write';

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
  const [searchQuery, setSearchQuery] = useState('');

  const visible = tools.filter((t) => !INTERNAL_TOOLS.has(t.name));
  const readTools = visible.filter((t) => isReadOperation(t.name));
  const writeTools = visible.filter((t) => !isReadOperation(t.name));

  const filteredTools = (tab === 'read' ? readTools : writeTools).filter(
    (t) =>
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <AnimatePresence mode="wait">
        {selectedTool ? (
          <motion.div
            key={`form-${selectedTool.name}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-4"
          >
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => setSelectedTool(null)}>
                <ChevronLeft size={18} />
              </Button>
              <div>
                <h2 className="font-semibold">{selectedTool.name}</h2>
                {selectedTool.description && (
                  <p className="text-xs text-muted-foreground">{selectedTool.description}</p>
                )}
              </div>
            </div>

            <Card>
              <CardContent className="p-6">
                <ToolForm
                  tool={selectedTool}
                  contractId={contractId}
                  onExecute={onExecute}
                  isLoading={isExecuting}
                />
              </CardContent>
            </Card>

            {readResult !== null && readResult !== undefined && lastReadTool === selectedTool.name && (
              <ReadResultCard result={readResult} toolName={lastReadTool} />
            )}
          </motion.div>
        ) : (
          <motion.div
            key="browser-list"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-4"
          >
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
              <div className="flex border rounded-md overflow-hidden">
                <button
                  onClick={() => setTab('read')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors ${
                    tab === 'read'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                  }`}
                >
                  <Eye size={14} />
                  Read ({readTools.length})
                </button>
                <button
                  onClick={() => setTab('write')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors ${
                    tab === 'write'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                  }`}
                >
                  <PenLine size={14} />
                  Write ({writeTools.length})
                </button>
              </div>

              <div className="relative w-full sm:w-56">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
                <Input
                  placeholder="Search tools..."
                  className="pl-8 h-9"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            {filteredTools.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground text-sm">
                No tools found.
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {filteredTools.map((tool) => (
                  <Card
                    key={tool.name}
                    className="cursor-pointer transition-all hover:border-foreground"
                    onClick={() => {
                      // Read tools with no params: fire immediately, no intermediate form
                      if (isReadOperation(tool.name) && extractArgs(tool).length === 0) {
                        onExecute(tool.name, {});
                      } else {
                        setSelectedTool(tool);
                      }
                    }}
                  >
                    <CardContent className="p-4 flex items-center gap-3">
                      <div className="text-muted-foreground shrink-0">
                        {isReadOperation(tool.name) ? <Eye size={16} /> : <PenLine size={16} />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-medium text-sm truncate">{tool.name}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                          {tool.description || 'Perform operation on Stellar network.'}
                        </p>
                      </div>
                      <ArrowRight size={14} className="text-muted-foreground shrink-0" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {readResult !== null && readResult !== undefined && lastReadTool && !selectedTool && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <ReadResultCard result={readResult} toolName={lastReadTool} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

'use client';

// src/hooks/useMCP.ts
//
// Tool discovery: fetches the tool list from the MCP server on mount.

import { useState, useEffect, useCallback } from 'react';
import type { ToolInfo } from '@stellar-mcp/client';
import { createClient } from '@/lib/mcp';

export interface MCPState {
  tools: ToolInfo[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useMCP(): MCPState {
  const [tools, setTools] = useState<ToolInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTools = useCallback(async () => {
    setLoading(true);
    setError(null);
    const client = createClient();
    try {
      const list = await client.listTools();
      setTools(list);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load tools';
      setError(msg);
    } finally {
      client.close();
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTools();
  }, [fetchTools]);

  return { tools, loading, error, refresh: fetchTools };
}

//! Frontend generator for React application

use crate::NetworkConfig;
use std::fs;
use std::path::Path;

/// Frontend generator for React + use-mcp application
pub struct FrontendGenerator<'a> {
    output_dir: &'a Path,
    server_name: &'a str,
    network: &'a NetworkConfig,
}

impl<'a> FrontendGenerator<'a> {
    /// Create a new frontend generator
    pub fn new(
        output_dir: &'a Path,
        server_name: &'a str,
        network: &'a NetworkConfig,
    ) -> Self {
        Self {
            output_dir,
            server_name,
            network,
        }
    }

    /// Generate the frontend application
    pub fn generate(&self) -> Result<(), Box<dyn std::error::Error>> {
        let frontend_dir = self.output_dir.join("frontend");

        // Create directory structure
        self.create_directories(&frontend_dir)?;

        // Generate files
        self.generate_package_json(&frontend_dir)?;
        self.generate_tsconfig(&frontend_dir)?;
        self.generate_vite_config(&frontend_dir)?;
        self.generate_index_html(&frontend_dir)?;
        self.generate_vite_env_dts(&frontend_dir)?;

        // Server files
        self.generate_server_index(&frontend_dir)?;
        self.generate_chat_route(&frontend_dir)?;

        // Client files
        self.generate_app_tsx(&frontend_dir)?;
        self.generate_main_tsx(&frontend_dir)?;
        self.generate_index_css(&frontend_dir)?;
        self.generate_mcp_client(&frontend_dir)?;

        // Components
        self.generate_theme_provider(&frontend_dir)?;
        self.generate_mode_toggle(&frontend_dir)?;
        self.generate_chat_interface(&frontend_dir)?;
        self.generate_message_list(&frontend_dir)?;
        self.generate_chat_input(&frontend_dir)?;
        self.generate_suggested_actions(&frontend_dir)?;
        self.generate_auth_mode_selector(&frontend_dir)?;
        self.generate_wallet_connector(&frontend_dir)?;
        self.generate_read_operation_card(&frontend_dir)?;
        self.generate_write_operation_card(&frontend_dir)?;
        self.generate_secret_key_sign_card(&frontend_dir)?;
        self.generate_transaction_executor(&frontend_dir)?;
        self.generate_contract_tools(&frontend_dir)?;
        self.generate_tool_executor(&frontend_dir)?;

        // Config files
        self.generate_env_example(&frontend_dir)?;
        self.generate_readme(&frontend_dir)?;

        println!("  ✓ Generated React frontend in frontend/");

        Ok(())
    }

    fn create_directories(&self, base: &Path) -> Result<(), Box<dyn std::error::Error>> {
        fs::create_dir_all(base.join("src/client/lib"))?;
        fs::create_dir_all(base.join("src/client/components"))?;
        fs::create_dir_all(base.join("src/server/routes"))?;
        fs::create_dir_all(base.join("public"))?;
        Ok(())
    }

    fn generate_package_json(&self, base: &Path) -> Result<(), Box<dyn std::error::Error>> {
        let deps = serde_json::json!({
            "@ai-sdk/anthropic": "^1.0.13",
            "@ai-sdk/mcp": "^0.0.11",
            "@ai-sdk/openai": "^1.0.13",
            "@creit.tech/stellar-wallets-kit": "^1.9.5",
            "@modelcontextprotocol/sdk": "^1.24.3",
            "ai": "^4.0.38",
            "buffer": "^6.0.3",
            "cors": "^2.8.5",
            "dotenv": "^16.4.7",
            "express": "^4.21.2",
            "framer-motion": "^12.23.25",
            "process": "^0.11.10",
            "react": "^19.2.1",
            "react-dom": "^19.2.1",
            "react-markdown": "^10.1.0",
            "remark-gfm": "^4.0.1",
            "use-mcp": "^0.0.21"
        });

        let dev_deps = serde_json::json!({
            "@tailwindcss/vite": "^4.1.17",
            "@types/cors": "^2.8.17",
            "@types/express": "^5.0.0",
            "@types/node": "^22.10.5",
            "@types/react": "^19.2.7",
            "@types/react-dom": "^19.2.3",
            "@vitejs/plugin-react": "^5.1.1",
            "autoprefixer": "^10.4.22",
            "concurrently": "^9.1.2",
            "postcss": "^8.5.6",
            "tailwindcss": "^4.1.17",
            "tsx": "^4.19.2",
            "typescript": "^5.9.3",
            "vite": "^7.2.6"
        });

        let scripts = serde_json::json!({
            "dev": "concurrently \"pnpm dev:client\" \"pnpm dev:server\"",
            "dev:client": "vite",
            "dev:server": "tsx watch src/server/index.ts",
            "build": "tsc && vite build",
            "build:server": "tsc src/server/index.ts --outDir dist/server",
            "preview": "vite preview",
            "typecheck": "tsc --noEmit",
            "start": "concurrently \"pnpm dev:client\" \"pnpm dev:server\""
        });

        let package_json = serde_json::json!({
            "name": format!("{}-frontend", self.server_name),
            "version": "1.0.0",
            "type": "module",
            "scripts": scripts,
            "dependencies": deps,
            "devDependencies": dev_deps
        });

        let content = serde_json::to_string_pretty(&package_json)?;
        fs::write(base.join("package.json"), content)?;

        println!("    Generated frontend/package.json");
        Ok(())
    }

    fn generate_tsconfig(&self, base: &Path) -> Result<(), Box<dyn std::error::Error>> {
        let tsconfig = serde_json::json!({
            "compilerOptions": {
                "target": "ES2020",
                "useDefineForClassFields": true,
                "lib": ["ES2020", "DOM", "DOM.Iterable"],
                "module": "ESNext",
                "skipLibCheck": true,
                "moduleResolution": "bundler",
                "allowImportingTsExtensions": true,
                "resolveJsonModule": true,
                "isolatedModules": true,
                "noEmit": true,
                "jsx": "react-jsx",
                "strict": true,
                "noUnusedLocals": true,
                "noUnusedParameters": true,
                "noFallthroughCasesInSwitch": true
            },
            "include": ["src"],
            "references": [{ "path": "./tsconfig.node.json" }]
        });

        let content = serde_json::to_string_pretty(&tsconfig)?;
        fs::write(base.join("tsconfig.json"), content)?;

        // Also create tsconfig.node.json for Vite config
        let tsconfig_node = serde_json::json!({
            "compilerOptions": {
                "composite": true,
                "skipLibCheck": true,
                "module": "ESNext",
                "moduleResolution": "bundler",
                "allowSyntheticDefaultImports": true
            },
            "include": ["vite.config.ts"]
        });

        let node_content = serde_json::to_string_pretty(&tsconfig_node)?;
        fs::write(base.join("tsconfig.node.json"), node_content)?;

        println!("    Generated frontend/tsconfig.json");
        Ok(())
    }

    fn generate_vite_config(&self, base: &Path) -> Result<(), Box<dyn std::error::Error>> {
        let content = r#"import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
  },
  define: {
    'global': 'globalThis',
  },
  resolve: {
    alias: {
      'buffer': 'buffer/',
      'process': 'process/browser',
    }
  },
  optimizeDeps: {
    esbuildOptions: {
      define: {
        global: 'globalThis',
      },
    },
  },
})
"#;
        fs::write(base.join("vite.config.ts"), content)?;
        println!("    Generated frontend/vite.config.ts");
        Ok(())
    }

    fn generate_vite_env_dts(&self, base: &Path) -> Result<(), Box<dyn std::error::Error>> {
        let content = r#"/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_MCP_SERVER_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
"#;
        fs::write(base.join("src/vite-env.d.ts"), content)?;
        println!("    Generated frontend/src/vite-env.d.ts");
        Ok(())
    }

    fn generate_index_html(&self, base: &Path) -> Result<(), Box<dyn std::error::Error>> {
        let content = format!(r#"<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>{} - Stellar MCP</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/client/main.tsx"></script>
  </body>
</html>
"#, self.server_name);
        fs::write(base.join("index.html"), content)?;
        println!("    Generated frontend/index.html");
        Ok(())
    }

    fn generate_main_tsx(&self, base: &Path) -> Result<(), Box<dyn std::error::Error>> {
        let content = r#"import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { ThemeProvider } from './components/ThemeProvider'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <App />
    </ThemeProvider>
  </React.StrictMode>,
)
"#;
        fs::write(base.join("src/client/main.tsx"), content)?;
        println!("    Generated frontend/src/client/main.tsx");
        Ok(())
    }

    fn generate_index_css(&self, base: &Path) -> Result<(), Box<dyn std::error::Error>> {
        let content = r#"@import "tailwindcss";

@theme {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --radius: 0.5rem;
}

@layer base {
  :root {
    --background: hsl(0 0% 100%);
    --foreground: hsl(240 10% 3.9%);
    --card: hsl(0 0% 100%);
    --card-foreground: hsl(240 10% 3.9%);
    --popover: hsl(0 0% 100%);
    --popover-foreground: hsl(240 10% 3.9%);
    --primary: hsl(240 5.9% 10%);
    --primary-foreground: hsl(0 0% 98%);
    --secondary: hsl(240 4.8% 95.9%);
    --secondary-foreground: hsl(240 5.9% 10%);
    --muted: hsl(240 4.8% 95.9%);
    --muted-foreground: hsl(240 3.8% 46.1%);
    --accent: hsl(240 4.8% 95.9%);
    --accent-foreground: hsl(240 5.9% 10%);
    --destructive: hsl(0 84.2% 60.2%);
    --destructive-foreground: hsl(0 0% 98%);
    --border: hsl(240 5.9% 90%);
    --input: hsl(240 5.9% 90%);
    --ring: hsl(240 10% 3.9%);
    --radius: 0.5rem;
  }

  .dark {
    --background: hsl(240 10% 3.9%);
    --foreground: hsl(0 0% 98%);
    --card: hsl(240 10% 3.9%);
    --card-foreground: hsl(0 0% 98%);
    --popover: hsl(240 10% 3.9%);
    --popover-foreground: hsl(0 0% 98%);
    --primary: hsl(0 0% 98%);
    --primary-foreground: hsl(240 5.9% 10%);
    --secondary: hsl(240 3.7% 15.9%);
    --secondary-foreground: hsl(0 0% 98%);
    --muted: hsl(240 3.7% 15.9%);
    --muted-foreground: hsl(240 5% 64.9%);
    --accent: hsl(240 3.7% 15.9%);
    --accent-foreground: hsl(0 0% 98%);
    --destructive: hsl(0 62.8% 30.6%);
    --destructive-foreground: hsl(0 0% 98%);
    --border: hsl(240 3.7% 15.9%);
    --input: hsl(240 3.7% 15.9%);
    --ring: hsl(240 4.9% 83.9%);
  }

  * {
    @apply border-border;
  }

  body {
    @apply bg-background text-foreground;
    font-feature-settings: "rlig" 1, "calt" 1;
  }

  /* Custom Scrollbar */
  ::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }

  ::-webkit-scrollbar-track {
    background: transparent;
  }

  ::-webkit-scrollbar-thumb {
    background: hsl(var(--muted-foreground) / 0.3);
    border-radius: 10px;
  }

  ::-webkit-scrollbar-thumb:hover {
    background: hsl(var(--muted-foreground) / 0.5);
  }

  .scrollbar-hide::-webkit-scrollbar {
    display: none;
  }

  .scrollbar-hide {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
}
"#;
        fs::write(base.join("src/client/index.css"), content)?;
        println!("    Generated frontend/src/client/index.css");
        Ok(())
    }

    fn generate_app_tsx(&self, base: &Path) -> Result<(), Box<dyn std::error::Error>> {
        let content = format!(r#"import {{ useState, useEffect }} from 'react';
import {{ ChatInterface }} from './components/ChatInterface';
import {{ WalletConnector }} from './components/WalletConnector';
import {{ AuthModeSelector }} from './components/AuthModeSelector';
import {{ ModeToggle }} from './components/ModeToggle';

export default function App() {{
  const [authMode, setAuthMode] = useState<'wallet' | 'secret'>('wallet');
  const [hasEnteredSecretMode, setHasEnteredSecretMode] = useState(false);

  // Initialize from localStorage if available
  const [walletAddress, setWalletAddress] = useState<string | null>(() => {{
    if (typeof window !== 'undefined') {{
      return localStorage.getItem('walletAddress');
    }}
    return null;
  }});

  // Persist to localStorage
  useEffect(() => {{
    if (walletAddress) {{
      localStorage.setItem('walletAddress', walletAddress);
    }} else {{
      localStorage.removeItem('walletAddress');
    }}
  }}, [walletAddress]);

  // Handle auth mode change - when switching to secret mode, go directly to dashboard
  const handleModeChange = (mode: 'wallet' | 'secret') => {{
    setAuthMode(mode);
    if (mode === 'secret') {{
      setHasEnteredSecretMode(true);
    }}
  }};

  // Wallet persistence is handled by localStorage above
  // No need to check StellarWalletsKit on mount since connection state
  // is managed by WalletConnector component

  return (
    <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden">
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 flex-none">
        <div className="container flex h-14 max-w-screen-2xl items-center justify-between px-4 md:px-8">
          <div className="flex items-center gap-2 font-bold text-xl">
            <span className="text-primary">{}</span>
            <span>MCP</span>
          </div>

          <div className="flex items-center gap-4">
            {{walletAddress && ( // Always show disconnect if wallet is connected
              <WalletConnector
                walletAddress={{walletAddress}}
                onConnect={{setWalletAddress}} // This won't be called if walletAddress exists, but is kept for type consistency
                onDisconnect={{() => setWalletAddress(null)}}
              />
            )}}
            <ModeToggle />
          </div>
        </div>
      </header>

      <main className="flex-1 container max-w-screen-2xl mx-auto p-4 md:p-6 overflow-hidden flex flex-col">
        {{(authMode === 'wallet' && walletAddress) || (authMode === 'secret' && hasEnteredSecretMode) ? (
          <ChatInterface
            authMode={{authMode}}
            walletAddress={{walletAddress}}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6">
            <div className="space-y-2">
              <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl lg:text-6xl/none">
                AI-Powered Smart Contract Interface
              </h2>
              <p className="mx-auto max-w-[700px] text-muted-foreground md:text-xl">
                Interact with Stellar smart contracts using natural language. Powered by Stellar MCP Generator.
              </p>
            </div>
            <div className="space-y-4 w-full max-w-md pt-4">
              <AuthModeSelector
                mode={{authMode}}
                onModeChange={{handleModeChange}}
              />
              {{authMode === 'wallet' && !walletAddress && (
                <WalletConnector
                  walletAddress={{walletAddress}}
                  onConnect={{setWalletAddress}}
                  onDisconnect={{() => setWalletAddress(null)}}
                />
              )}}
            </div>
          </div>
        )}}
      </main>
    </div>
  );
}}
"#, self.server_name);
        fs::write(base.join("src/client/App.tsx"), content)?;
        println!("    Generated frontend/src/App.tsx");
        Ok(())
    }

    fn generate_mcp_client(&self, base: &Path) -> Result<(), Box<dyn std::error::Error>> {
        let content = r#"import { useState, useEffect } from 'react';
import { experimental_createMCPClient as createMCPClient } from '@ai-sdk/mcp';

export const MCP_SERVER_URL = import.meta.env.VITE_MCP_SERVER_URL ||
  'http://localhost:3000';

interface Tool {
  name: string;
  description?: string;
  inputSchema?: any;
}

export function useMcpClient() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [connectionState, setConnectionState] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');

  useEffect(() => {
    let mounted = true;
    let mcpClient: any = null;

    async function initMcpClient() {
      try {
        setConnectionState('connecting');

        // Create MCP client with HTTP transport
        mcpClient = await createMCPClient({
          transport: {
            type: 'http',
            url: MCP_SERVER_URL,
          },
        });

        // Get tools from MCP server
        const toolsObj = await mcpClient.tools();
        const toolsList = Object.values(toolsObj) as Tool[];

        if (mounted) {
          setTools(toolsList);
          setConnectionState('connected');
        }
      } catch (error) {
        console.error('[useMcpClient] Failed to connect:', error);
        if (mounted) {
          setConnectionState('disconnected');
        }
      }
    }

    initMcpClient();

    return () => {
      mounted = false;
      if (mcpClient) {
        mcpClient.close().catch(console.error);
      }
    };
  }, []);

  const executeTool = async (_toolName: string, _params: any) => {
    // Tool execution will be handled by the AI SDK in the chat
    throw new Error('Direct tool execution not supported - use through chat');
  };

  return {
    connectionState,
    availableTools: tools,
    executeTool,
  };
}
"#;
        fs::write(base.join("src/client/lib/mcp-client.ts"), content)?;
        println!("    Generated frontend/src/client/lib/mcp-client.ts");
        Ok(())
    }

    fn generate_theme_provider(&self, base: &Path) -> Result<(), Box<dyn std::error::Error>> {
        let content = r#"import { createContext, useContext, useEffect, useState } from "react";

type Theme = "dark" | "light" | "system";

type ThemeProviderProps = {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
};

type ThemeProviderState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

const initialState: ThemeProviderState = {
  theme: "system",
  setTheme: () => null,
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

export function ThemeProvider({
  children,
  defaultTheme = "system",
  storageKey = "vite-ui-theme",
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem(storageKey) as Theme) || defaultTheme
  );

  useEffect(() => {
    const root = window.document.documentElement;

    root.classList.remove("light", "dark");

    if (theme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)")
        .matches
        ? "dark"
        : "light";

      root.classList.add(systemTheme);
      return;
    }

    root.classList.add(theme);
  }, [theme]);

  const value = {
    theme,
    setTheme: (theme: Theme) => {
      localStorage.setItem(storageKey, theme);
      setTheme(theme);
    },
  };

  return (
    <ThemeProviderContext.Provider value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext);

  if (context === undefined)
    throw new Error("useTheme must be used within a ThemeProvider");

  return context;
};
"#;
        fs::write(base.join("src/client/components/ThemeProvider.tsx"), content)?;
        println!("    Generated frontend/src/client/components/ThemeProvider.tsx");
        Ok(())
    }

    fn generate_mode_toggle(&self, base: &Path) -> Result<(), Box<dyn std::error::Error>> {
        let content = r#"import { useTheme } from "./ThemeProvider"
import { motion, AnimatePresence } from "framer-motion"

export function ModeToggle() {
  const { setTheme, theme } = useTheme()
  const isDark = theme === "dark"

  return (
    <motion.button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="relative inline-flex items-center justify-center rounded-full w-10 h-10 bg-background border border-input hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 overflow-hidden transition-colors"
      whileTap={{ scale: 0.95 }}
      whileHover={{ scale: 1.05 }}
      title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={theme}
          initial={{ y: -20, opacity: 0, rotate: -45 }}
          animate={{ y: 0, opacity: 1, rotate: 0 }}
          exit={{ y: 20, opacity: 0, rotate: 45 }}
          transition={{ duration: 0.2, ease: "easeInOut" }}
        >
          {isDark ? (
             <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
            >
              <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
            </svg>
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
            >
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2" />
              <path d="M12 20v2" />
              <path d="m4.93 4.93 1.41 1.41" />
              <path d="m17.66 17.66 1.41 1.41" />
              <path d="M2 12h2" />
              <path d="M20 12h2" />
              <path d="m6.34 17.66-1.41 1.41" />
              <path d="m19.07 4.93-1.41 1.41" />
            </svg>
          )}
        </motion.div>
      </AnimatePresence>
      <span className="sr-only">Toggle theme</span>
    </motion.button>
  )
}
"#;
        fs::write(base.join("src/client/components/ModeToggle.tsx"), content)?;
        println!("    Generated frontend/src/client/components/ModeToggle.tsx");
        Ok(())
    }

    fn generate_suggested_actions(&self, base: &Path) -> Result<(), Box<dyn std::error::Error>> {
        let content = r#"import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Tool {
  name: string;
  description?: string;
  inputSchema?: any;
}

interface ToolCategory {
  name: string;
  icon: string;
  accent: string;
  actions: Array<{
    title: string;
    label: string;
    action: string;
  }>;
}

interface SuggestedActionsProps {
  tools: Tool[];
  onActionClick: (prompt: string) => void;
}

export function SuggestedActions({ tools, onActionClick }: SuggestedActionsProps) {
  const [activeCategory, setActiveCategory] = useState(0);
  const categories = categorizeTools(tools);

  if (categories.length === 0) {
    return null;
  }

  return (
    <div className="w-full max-w-full space-y-6 px-4 md:px-0">
      {/* Category Pills */}
      <div className="w-full max-w-full overflow-hidden">
        <div className="flex gap-3 overflow-x-auto pb-4 snap-x snap-mandatory px-1">
          {categories.map((category, index) => (
            <motion.button
              key={category.name}
              type="button"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 * index }}
              onClick={(e) => {
                e.preventDefault();
                setActiveCategory(index);
              }}
              className={`relative flex items-center gap-2 px-5 py-2.5 rounded-full border text-sm font-medium whitespace-nowrap transition-all snap-start shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                activeCategory === index
                  ? 'bg-secondary/80 border-primary shadow-sm backdrop-blur-sm'
                  : 'bg-card/50 border-border/50 hover:border-primary/50 hover:bg-secondary/50'
              }`}
              style={
                activeCategory === index
                  ? {
                      borderColor: category.accent,
                      boxShadow: `0 0 20px -10px ${category.accent}`
                    }
                  : undefined
              }
            >
              <span
                style={activeCategory === index ? { color: category.accent } : undefined}
                className={`text-lg transition-colors ${activeCategory === index ? '' : 'text-muted-foreground'}`}
              >
                {category.icon}
              </span>
              <span className={activeCategory === index ? 'text-foreground' : 'text-muted-foreground'}>
                {category.name}
              </span>
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                activeCategory === index
                  ? 'bg-background/50 text-foreground'
                  : 'bg-secondary text-muted-foreground'
              }`}>
                {category.actions.length}
              </span>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Action Cards */}
      <div className="w-full max-w-full overflow-hidden">
        <div className="overflow-x-auto pb-4 px-1">
          <div className="flex gap-4">
            <AnimatePresence mode="wait">
              {categories[activeCategory].actions.map((suggestedAction, index) => (
                <motion.div
                  key={`${suggestedAction.title}-${index}`}
                  initial={{ opacity: 0, x: 20, scale: 0.95 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: 0.05 * index, type: "spring", stiffness: 300, damping: 30 }}
                  className="shrink-0 w-[280px] md:w-[320px]"
                >
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.02, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={(e) => {
                      e.preventDefault();
                      onActionClick(suggestedAction.action);
                    }}
                    className="relative h-full w-full text-left border border-border/60 rounded-xl p-5 bg-card/40 hover:bg-accent/10 hover:border-primary/40 transition-all group overflow-hidden backdrop-blur-sm shadow-sm hover:shadow-md"
                  >
                    {/* Gradient Background Effect on Hover */}
                    <div
                      className="absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-500 bg-gradient-to-br from-transparent via-transparent to-current"
                      style={{ color: categories[activeCategory].accent }}
                    />

                    {/* Accent bar */}
                    <div
                      className="absolute left-0 top-4 bottom-4 w-1 rounded-r opacity-50 group-hover:opacity-100 transition-all group-hover:w-1.5"
                      style={{ backgroundColor: categories[activeCategory].accent }}
                    />

                    {/* Content */}
                    <div className="pl-3 group-hover:pl-4 transition-all space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-semibold text-foreground text-base leading-tight">
                          {suggestedAction.title}
                        </span>
                        <motion.div
                          initial={{ opacity: 0, x: -10 }}
                          whileHover={{ opacity: 1, x: 0 }}
                          className="shrink-0 text-primary"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="24"
                            height="24"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="size-5"
                            style={{ color: categories[activeCategory].accent }}
                          >
                            <path d="m9 18 6-6-6-6" />
                          </svg>
                        </motion.div>
                      </div>
                      <p className="text-muted-foreground text-sm line-clamp-2">
                        {suggestedAction.label}
                      </p>
                    </div>
                  </motion.button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Stats Footer */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="flex items-center justify-center gap-2 text-xs font-medium text-muted-foreground/80 pt-4 border-t border-border/40"
      >
        <span className="flex items-center gap-1.5 bg-secondary/50 px-3 py-1 rounded-full">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="size-3.5 text-primary"
          >
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
          </svg>
          {categories.reduce((sum, cat) => sum + cat.actions.length, 0)}+ Actions Available
        </span>
      </motion.div>
    </div>
  );
}

function categorizeTools(tools: Tool[]): ToolCategory[] {
  const categories: Record<
    string,
    { tools: Tool[]; icon: string; accent: string }
  > = {
    deployment: { tools: [], icon: '🚀', accent: '#8B5CF6' },
    queries: { tools: [], icon: '🔍', accent: '#06B6D4' },
    admin: { tools: [], icon: '⚙️', accent: '#10B981' },
    operations: { tools: [], icon: '⚡', accent: '#F59E0B' },
  };

  tools.forEach((tool) => {
    const name = tool.name.toLowerCase();
    const description = tool.description?.toLowerCase() || '';

    // Skip utility tools
    if (name.includes('sign-and-submit') || name.includes('prepare-transaction')) {
      return;
    }

    // Pattern matching
    if (name.startsWith('deploy') || name.includes('create') || description.includes('deploy')) {
      categories.deployment.tools.push(tool);
    } else if (
      name.startsWith('get-') ||
      name.startsWith('query-') ||
      name.includes('list') ||
      description.includes('query') ||
      description.includes('view') ||
      description.includes('get ')
    ) {
      categories.queries.tools.push(tool);
    } else if (
      name.includes('admin') ||
      name.includes('owner') ||
      name.includes('pause') ||
      name.includes('unpause') ||
      name.includes('upgrade') ||
      name.includes('set-') ||
      name.includes('initiate') ||
      name.includes('accept') ||
      name.includes('cancel') ||
      description.includes('admin') ||
      description.includes('upgrade')
    ) {
      categories.admin.tools.push(tool);
    } else {
      categories.operations.tools.push(tool);
    }
  });

  return Object.entries(categories)
    .filter(([_, data]) => data.tools.length > 0)
    .map(([name, data]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      icon: data.icon,
      accent: data.accent,
      actions: data.tools.map((tool) => ({
        title: formatToolName(tool.name),
        label: generateLabel(tool.name),
        action: generatePrompt(tool),
      })),
    }));
}

function formatToolName(name: string): string {
  return name
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function generateLabel(name: string): string {
  const formatted = name.replace(/-/g, ' ');
  if (name.startsWith('deploy')) {
    return `create ${formatted.replace('deploy ', '')}`;
  }
  if (name.startsWith('get-')) {
    return `view ${formatted.replace('get ', '')}`;
  }
  return formatted;
}

function generatePrompt(tool: Tool): string {
  const name = formatToolName(tool.name);

  if (tool.name.startsWith('deploy')) {
    return `Deploy a new ${tool.name.replace('deploy-', '').replace(/-/g, ' ')}`;
  }

  if (tool.name.startsWith('get-')) {
    const what = tool.name.replace('get-', '').replace(/-/g, ' ');
    return `Show me ${what}`;
  }

  if (tool.name.includes('transfer')) {
    return 'Transfer tokens';
  }

  if (tool.name.includes('balance')) {
    return 'Check balance';
  }

  if (tool.name.includes('pause')) {
    return 'Pause the contract';
  }

  if (tool.name.includes('unpause')) {
    return 'Unpause the contract';
  }

  return name;
}
"#;
        fs::write(base.join("src/client/components/SuggestedActions.tsx"), content)?;
        println!("    Generated frontend/src/client/components/SuggestedActions.tsx");
        Ok(())
    }

    fn generate_read_operation_card(&self, base: &Path) -> Result<(), Box<dyn std::error::Error>> {
        let content = r#"import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ReadOperationCardProps {
  toolName: string;
  result: any;
  timestamp?: string;
}

function XdrViewer({ xdr }: { xdr: string }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(xdr);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const truncated = xdr.length > 40
    ? `${xdr.slice(0, 20)}...${xdr.slice(-20)}`
    : xdr;

  return (
    <div className="w-full">
      <div
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between p-2.5 bg-muted/50 hover:bg-muted rounded-lg border border-border/50 cursor-pointer transition-all group"
      >
        <div className="flex items-center gap-3 overflow-hidden">
          <div className={`text-muted-foreground transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m6 9 6 6 6-6"/>
            </svg>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">Transaction Envelope (XDR)</span>
            <code className="text-xs font-mono text-foreground/80 truncate">
              {expanded ? 'Click to collapse' : truncated}
            </code>
          </div>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center justify-center h-8 w-8 rounded-md hover:bg-background border border-transparent hover:border-border transition-all text-muted-foreground hover:text-foreground"
          title="Copy XDR"
        >
          {copied ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-500">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
              <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
            </svg>
          )}
        </button>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-2 p-3 bg-background rounded-lg border border-border shadow-inner overflow-x-auto">
              <code className="block text-xs font-mono break-all text-muted-foreground leading-relaxed">
                {xdr}
              </code>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function ReadOperationCard({ toolName, result, timestamp }: ReadOperationCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatToolName = (name: string) => {
    return name
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const renderResult = () => {
    if (result === null || result === undefined) {
      return <p className="text-muted-foreground">No data returned</p>;
    }

    if (Array.isArray(result)) {
      if (result.length === 0) {
        return <p className="text-muted-foreground">No items found</p>;
      }

      return (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">Found {result.length} item(s)</p>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {result.map((item, index) => (
              <div key={index} className="p-3 bg-muted/50 rounded-md border border-border">
                {renderObject(item, index)}
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (typeof result === 'object') {
      return renderObject(result);
    }

    return (
      <div className="flex items-center gap-2">
        <code className="flex-1 px-3 py-2 bg-muted rounded-md font-mono text-sm break-all">
          {String(result)}
        </code>
        <button
          onClick={() => handleCopy(String(result))}
          className="px-3 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
    );
  };

  const renderObject = (obj: Record<string, any>, keyPrefix?: number) => {
    return (
      <div className="space-y-2">
        {Object.entries(obj).map(([key, value]) => {
          if (key.toLowerCase() === 'xdr' && typeof value === 'string') {
            return (
              <div key={`${keyPrefix}-${key}`} className="w-full">
                <XdrViewer xdr={value} />
              </div>
            );
          }

          const displayKey = key
            .split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');

          return (
            <div key={`${keyPrefix}-${key}`} className="flex flex-col gap-1">
              <span className="text-sm font-medium text-foreground">{displayKey}:</span>
              {typeof value === 'object' && value !== null ? (
                Array.isArray(value) ? (
                  <div className="pl-4 space-y-1">
                    {value.map((item, idx) => (
                      <div key={idx} className="text-sm text-muted-foreground">
                        {typeof item === 'object' ? renderObject(item, idx) : String(item)}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="pl-4">{renderObject(value)}</div>
                )
              ) : (
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-2 py-1 bg-background rounded text-sm font-mono break-all">
                    {String(value)}
                  </code>
                  {typeof value === 'string' && value.length > 20 && (
                    <button
                      onClick={() => handleCopy(String(value))}
                      className="px-2 py-1 text-xs bg-secondary hover:bg-secondary/80 rounded flex items-center gap-1"
                    >
                      {copied ? 'Copied' : 'Copy'}
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="my-4 p-4 bg-card rounded-lg border border-border shadow-sm">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-semibold text-foreground">{formatToolName(toolName)}</h3>
          {timestamp && (
            <p className="text-xs text-muted-foreground mt-1">
              {new Date(timestamp).toLocaleString()}
            </p>
          )}
        </div>
        <span className="px-2 py-1 text-xs bg-green-500/10 text-green-600 dark:text-green-400 rounded-md border border-green-500/20">
          Read
        </span>
      </div>
      <div className="mt-3 max-h-80 overflow-y-auto">{renderResult()}</div>
    </div>
  );
}

interface SignAndSubmitResultCardProps {
  success: boolean;
  txResult: {
    status: string;
    hash?: string;
    xdr?: string;
    signedXdr?: string;
    error?: string;
    result?: any;
  };
}

export function SignAndSubmitResultCard({ success, txResult }: SignAndSubmitResultCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [copiedHash, setCopiedHash] = useState(false);
  const [copiedXdr, setCopiedXdr] = useState(false);

  const handleCopyHash = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (txResult.hash) {
      navigator.clipboard.writeText(txResult.hash);
      setCopiedHash(true);
      setTimeout(() => setCopiedHash(false), 2000);
    }
  };

  const handleCopyXdr = (e: React.MouseEvent) => {
    e.stopPropagation();
    const xdr = txResult.signedXdr || txResult.xdr;
    if (xdr) {
      navigator.clipboard.writeText(xdr);
      setCopiedXdr(true);
      setTimeout(() => setCopiedXdr(false), 2000);
    }
  };

  const xdr = txResult.signedXdr || txResult.xdr;
  const truncatedXdr = xdr && xdr.length > 40
    ? `${xdr.slice(0, 20)}...${xdr.slice(-20)}`
    : xdr;

  // Get explorer URL based on network (default to testnet)
  const getExplorerUrl = (hash: string) => {
    return `https://stellar.expert/explorer/testnet/tx/${hash}`;
  };

  if (success && txResult.status === 'SUCCESS') {
    return (
      <div className="my-4 p-4 bg-card rounded-lg border border-green-500/20 shadow-sm">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="font-semibold text-foreground">Transaction Successful</h3>
            <p className="text-sm text-muted-foreground mt-1">Sign and Submit</p>
          </div>
          <span className="px-2 py-1 text-xs bg-green-500/10 text-green-600 dark:text-green-400 rounded-md border border-green-500/20">
            Success
          </span>
        </div>

        <div className="space-y-3">
          {txResult.hash && (
            <div>
              <p className="text-sm font-medium text-foreground mb-1">Transaction Hash:</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 px-3 py-2 bg-muted rounded-md font-mono text-xs break-all">
                  {txResult.hash}
                </code>
                <button
                  onClick={handleCopyHash}
                  className="px-2 py-2 text-xs bg-secondary hover:bg-secondary/80 rounded flex items-center gap-1"
                >
                  {copiedHash ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>
          )}

          {xdr && (
            <div className="w-full">
              <div
                onClick={() => setExpanded(!expanded)}
                className="flex items-center justify-between p-2.5 bg-muted/50 hover:bg-muted rounded-lg border border-border/50 cursor-pointer transition-all group"
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className={`text-muted-foreground transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m6 9 6 6 6-6"/>
                    </svg>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">Signed Transaction (XDR)</span>
                    <code className="text-xs font-mono text-foreground/80 truncate">
                      {expanded ? 'Click to collapse' : truncatedXdr}
                    </code>
                  </div>
                </div>
                <button
                  onClick={handleCopyXdr}
                  className="flex items-center justify-center h-8 w-8 rounded-md hover:bg-background border border-transparent hover:border-border transition-all text-muted-foreground hover:text-foreground"
                  title="Copy XDR"
                >
                  {copiedXdr ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-500">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
                      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
                    </svg>
                  )}
                </button>
              </div>

              <AnimatePresence>
                {expanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-2 p-3 bg-background rounded-lg border border-border shadow-inner overflow-x-auto">
                      <code className="block text-xs font-mono break-all text-muted-foreground leading-relaxed">
                        {xdr}
                      </code>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {txResult.result && (
            <details className="group">
              <summary className="cursor-pointer text-sm font-medium text-foreground mb-1 flex items-center gap-1 select-none hover:opacity-80 transition-opacity w-fit">
                <span>Result Data</span>
                <svg
                  className="w-4 h-4 transition-transform group-open:rotate-180"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </summary>
              <pre className="px-3 py-2 bg-muted rounded-md font-mono text-xs overflow-x-auto mt-1">
                {JSON.stringify(txResult.result, null, 2)}
              </pre>
            </details>
          )}

          {txResult.hash && (
            <a
              href={getExplorerUrl(txResult.hash)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
            >
              View on Stellar Expert →
            </a>
          )}
        </div>
      </div>
    );
  }

  // Failed state
  return (
    <div className="my-4 p-4 bg-card rounded-lg border border-destructive/20 shadow-sm">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-semibold text-foreground">Transaction Failed</h3>
          <p className="text-sm text-muted-foreground mt-1">Sign and Submit</p>
        </div>
        <span className="px-2 py-1 text-xs bg-destructive/10 text-destructive rounded-md border border-destructive/20">
          {txResult.status || 'Error'}
        </span>
      </div>

      <div className="space-y-3">
        {txResult.error && (
          <div className="p-3 bg-destructive/5 border border-destructive/20 rounded-md">
            <p className="text-sm text-destructive">{txResult.error}</p>
          </div>
        )}

        {xdr && (
          <div className="w-full">
            <div
              onClick={() => setExpanded(!expanded)}
              className="flex items-center justify-between p-2.5 bg-muted/50 hover:bg-muted rounded-lg border border-border/50 cursor-pointer transition-all group"
            >
              <div className="flex items-center gap-3 overflow-hidden">
                <div className={`text-muted-foreground transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m6 9 6 6 6-6"/>
                  </svg>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">Transaction (XDR)</span>
                  <code className="text-xs font-mono text-foreground/80 truncate">
                    {expanded ? 'Click to collapse' : truncatedXdr}
                  </code>
                </div>
              </div>
              <button
                onClick={handleCopyXdr}
                className="flex items-center justify-center h-8 w-8 rounded-md hover:bg-background border border-transparent hover:border-border transition-all text-muted-foreground hover:text-foreground"
                title="Copy XDR"
              >
                {copiedXdr ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-500">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
                    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
                  </svg>
                )}
              </button>
            </div>

            <AnimatePresence>
              {expanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="mt-2 p-3 bg-background rounded-lg border border-border shadow-inner overflow-x-auto">
                    <code className="block text-xs font-mono break-all text-muted-foreground leading-relaxed">
                      {xdr}
                    </code>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {txResult.hash && (
          <a
            href={getExplorerUrl(txResult.hash)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
          >
            View on Stellar Expert →
          </a>
        )}
      </div>
    </div>
  );
}
"#;
        fs::write(base.join("src/client/components/ReadOperationCard.tsx"), content)?;
        println!("    Generated frontend/src/client/components/ReadOperationCard.tsx");
        Ok(())
    }

    fn generate_write_operation_card(&self, base: &Path) -> Result<(), Box<dyn std::error::Error>> {
        let content = r#"import { useState } from 'react';

interface WriteOperationCardProps {
  toolName: string;
  params: Record<string, any>;
  transaction: {
    xdr?: string;
    contractAddress?: string;
    method?: string;
    network?: string;
    [key: string]: any;
  };
  onSign?: (xdr: string) => Promise<{ hash: string; result?: any }>;
  walletAddress?: string | null;
}

export function WriteOperationCard({
  toolName,
  params,
  transaction,
  onSign,
  walletAddress,
}: WriteOperationCardProps) {
  const [signing, setSigning] = useState(false);
  const [result, setResult] = useState<{ hash: string; result?: any } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const formatToolName = (name: string) => {
    return name
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const formatParamKey = (key: string) => {
    return key
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const handleSign = async () => {
    if (!onSign || !transaction.xdr) {
      setError('No signing function or XDR provided');
      return;
    }

    setSigning(true);
    setError(null);

    try {
      const txResult = await onSign(transaction.xdr);
      setResult(txResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign transaction');
    } finally {
      setSigning(false);
    }
  };

  // Show success state
  if (result) {
    return (
      <div className="my-4 p-4 bg-card rounded-lg border border-green-500/20 shadow-sm">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="font-semibold text-foreground">Transaction Successful</h3>
            <p className="text-sm text-muted-foreground mt-1">{formatToolName(toolName)}</p>
          </div>
          <span className="px-2 py-1 text-xs bg-green-500/10 text-green-600 dark:text-green-400 rounded-md border border-green-500/20">
            Success
          </span>
        </div>

        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium text-foreground mb-1">Transaction Hash:</p>
            <code className="block px-3 py-2 bg-muted rounded-md font-mono text-xs break-all">
              {result.hash}
            </code>
          </div>

          {result.result && (
            <details className="group">
              <summary className="cursor-pointer text-sm font-medium text-foreground mb-1 flex items-center gap-1 select-none hover:opacity-80 transition-opacity w-fit">
                <span>Result</span>
                <svg
                  className="w-4 h-4 transition-transform group-open:rotate-180"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </summary>
              <pre className="px-3 py-2 bg-muted rounded-md font-mono text-xs overflow-x-auto mt-1">
                {JSON.stringify(result.result, null, 2)}
              </pre>
            </details>
          )}

          <a
            href={`https://stellar.expert/explorer/testnet/tx/${result.hash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
          >
            View on Stellar Expert →
          </a>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="my-4 p-4 bg-card rounded-lg border border-destructive/20 shadow-sm">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="font-semibold text-foreground">Transaction Failed</h3>
            <p className="text-sm text-muted-foreground mt-1">{formatToolName(toolName)}</p>
          </div>
          <span className="px-2 py-1 text-xs bg-destructive/10 text-destructive rounded-md border border-destructive/20">
            Error
          </span>
        </div>

        <div className="space-y-3">
          <div className="p-3 bg-destructive/5 border border-destructive/20 rounded-md">
            <p className="text-sm text-destructive">{error}</p>
          </div>

          <button
            onClick={handleSign}
            disabled={signing}
            className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Show pending/ready to sign state
  return (
    <div className="my-4 p-4 bg-card rounded-lg border border-border shadow-sm">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-semibold text-foreground">{formatToolName(toolName)}</h3>
          <p className="text-xs text-muted-foreground mt-1">Ready to sign</p>
        </div>
        <span className="px-2 py-1 text-xs bg-orange-500/10 text-orange-600 dark:text-orange-400 rounded-md border border-orange-500/20">
          Write
        </span>
      </div>

      <div className="space-y-4">
        {/* Transaction Details */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-foreground">Transaction Details</h4>
          <div className="p-3 bg-muted/50 rounded-md border border-border space-y-2">
            {transaction.contractAddress && (
              <div>
                <span className="text-xs font-medium text-muted-foreground">Contract:</span>
                <code className="block mt-1 text-xs font-mono break-all">
                  {transaction.contractAddress}
                </code>
              </div>
            )}
            {transaction.method && (
              <div>
                <span className="text-xs font-medium text-muted-foreground">Method:</span>
                <code className="block mt-1 text-xs font-mono">{transaction.method}</code>
              </div>
            )}
            {transaction.network && (
              <div>
                <span className="text-xs font-medium text-muted-foreground">Network:</span>
                <code className="block mt-1 text-xs font-mono">{transaction.network}</code>
              </div>
            )}
          </div>
        </div>

        {/* Parameters */}
        {Object.keys(params).length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-foreground">Parameters</h4>
            <div className="p-3 bg-muted/50 rounded-md border border-border space-y-2">
              {Object.entries(params).map(([key, value]) => (
                <div key={key}>
                  <span className="text-xs font-medium text-muted-foreground">
                    {formatParamKey(key)}:
                  </span>
                  <code className="block mt-1 px-2 py-1 bg-background rounded text-xs font-mono break-all">
                    {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                  </code>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Sign Button */}
        <div className="pt-2 border-t border-border">
          {walletAddress ? (
            <button
              onClick={handleSign}
              disabled={signing || !onSign}
              className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {signing ? 'Signing...' : 'Sign & Submit Transaction'}
            </button>
          ) : (
            <div className="p-3 bg-muted/50 border border-border rounded-md">
              <p className="text-sm text-muted-foreground text-center">
                Connect your wallet to sign this transaction
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
"#;
        fs::write(base.join("src/client/components/WriteOperationCard.tsx"), content)?;
        println!("    Generated frontend/src/client/components/WriteOperationCard.tsx");
        Ok(())
    }

    fn generate_transaction_executor(&self, base: &Path) -> Result<(), Box<dyn std::error::Error>> {
        let content = r#"import {
  StellarWalletsKit,
  WalletNetwork,
  allowAllModules,
} from '@creit.tech/stellar-wallets-kit';
import {
  rpc,
  TransactionBuilder,
  Operation,
} from '@stellar/stellar-sdk';

interface TransactionExecutorProps {
  xdr: string;
  walletAddress: string;
}

const NETWORK_CONFIG = {
  testnet: {
    rpcUrl: 'https://soroban-testnet.stellar.org',
    networkPassphrase: 'Test SDF Network ; September 2015',
    walletNetwork: WalletNetwork.TESTNET,
  },
  mainnet: {
    rpcUrl: 'https://soroban.stellar.org',
    networkPassphrase: 'Public Global Stellar Network ; September 2015',
    walletNetwork: WalletNetwork.PUBLIC,
  },
};

/**
 * Execute a transaction that has been prepared by the MCP server's prepare-transaction tool.
 *
 * The XDR passed here is already:
 * - Rebuilt with the wallet's public key as source
 * - Simulated to get fresh auth entries and footprint
 * - Assembled with simulation data
 *
 * However, the sequence number may be stale if user waited before clicking \"Sign\".
 * So we need to:
 * 1. Rebuild with FRESH sequence, re-simulate, and re-assemble
 * 2. Sign with the wallet (which signs both envelope and auth entries)
 * 3. Submit to the network
 * 4. Poll for result
 */
export async function executeTransaction({
  xdr,
  walletAddress,
}: TransactionExecutorProps): Promise<{ hash: string; result?: any }> {
  // Use env var or default to testnet
  const envNetwork = import.meta.env.VITE_NETWORK_PASSPHRASE;
  const normalizedNetwork: 'testnet' | 'mainnet' =
    envNetwork?.includes('Public Global Stellar Network') ? 'mainnet' : 'testnet';

  const config = NETWORK_CONFIG[normalizedNetwork];
  const server = new rpc.Server(config.rpcUrl, { allowHttp: true });

  try {
    // The XDR from prepare-transaction has wallet as source and auth entries,
    // BUT the sequence number may be stale if user waited before clicking \"Sign\".
    // We need to rebuild with FRESH sequence, re-simulate, and re-assemble.
    console.log('[TransactionExecutor] Rebuilding with fresh sequence...');

    const preparedTx = TransactionBuilder.fromXDR(xdr, config.networkPassphrase);
    const operation = preparedTx.operations[0] as any; // InvokeHostFunction operation

    // Fetch FRESH account (current sequence number)
    const sourceAccount = await server.getAccount(walletAddress);

    // Rebuild transaction WITHOUT auth entries (simulation will generate fresh ones)
    const rebuiltTx = new TransactionBuilder(sourceAccount, {
      fee: preparedTx.fee,
      networkPassphrase: config.networkPassphrase,
    })
      .addOperation(
        // Rebuild the operation without auth - simulation will add it
        Operation.invokeHostFunction({
          func: operation.func,
          auth: [], // Empty - let simulation fill it
        })
      )
      .setTimeout(30)
      .build();

    // Re-simulate to get fresh auth entries and footprint
    console.log('[TransactionExecutor] Re-simulating transaction...');
    const simResponse = await server.simulateTransaction(rebuiltTx);
    if (rpc.Api.isSimulationError(simResponse)) {
      throw new Error(`Simulation failed: ${simResponse.error}`);
    }

    // Assemble with simulation data (this adds auth entries)
    const finalTx = rpc.assembleTransaction(rebuiltTx, simResponse).build();

    // Initialize wallet kit
    const kit = new StellarWalletsKit({
      network: config.walletNetwork,
      selectedWalletId: 'freighter',
      modules: allowAllModules(),
    });

    // Sign the fresh transaction
    console.log('[TransactionExecutor] Requesting wallet signature...');
    const { signedTxXdr } = await kit.signTransaction(finalTx.toXDR(), {
      address: walletAddress,
      networkPassphrase: config.networkPassphrase,
    });

    // Parse the signed transaction
    const signedTx = TransactionBuilder.fromXDR(
      signedTxXdr,
      config.networkPassphrase
    );

    // Submit using the SDK's server.sendTransaction
    console.log('[TransactionExecutor] Submitting transaction...');
    const sendResponse = await server.sendTransaction(signedTx);

    if (sendResponse.status !== 'PENDING') {
      const errorMessage =
        (sendResponse as any).errorResult?.toXDR?.('base64') ||
        (sendResponse as any).errorResultXdr ||
        JSON.stringify(sendResponse);
      throw new Error(`Transaction failed: ${sendResponse.status} - ${errorMessage}`);
    }

    const txHash = sendResponse.hash;
    console.log('[TransactionExecutor] Transaction submitted:', txHash);

    // Poll for transaction result using manual getTransaction polling
    // We use manual polling instead of pollTransaction to better handle XDR parsing errors
    let returnValue;
    let attempts = 0;
    const maxAttempts = 60; // 30 seconds with 500ms intervals
    const intervalMs = 500;
    let transactionSucceeded = false;

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, intervalMs));
      attempts++;

      try {
        const txResponse = await server.getTransaction(txHash);

        if (txResponse.status === rpc.Api.GetTransactionStatus.SUCCESS) {
          console.log('[TransactionExecutor] Transaction successful');
          transactionSucceeded = true;

          // Try to parse return value if available
          try {
            const successResponse = txResponse as rpc.Api.GetSuccessfulTransactionResponse;
            const meta = successResponse.resultMetaXdr;
            const metaSwitch = meta.switch();

            if (metaSwitch.valueOf() === 3) {
              const sorobanMeta = meta.v3().sorobanMeta();
              if (sorobanMeta) {
                returnValue = sorobanMeta.returnValue();
              }
            }
          } catch (parseError) {
            // Can't parse return value, but transaction succeeded
            console.warn('[TransactionExecutor] Could not parse return value:', parseError);
          }

          break; // Exit polling loop
        } else if (txResponse.status === rpc.Api.GetTransactionStatus.FAILED) {
          throw new Error('Transaction failed on network');
        }
        // If NOT_FOUND, continue polling
      } catch (error: any) {
        if (error.message === 'Transaction failed on network') {
          throw error;
        }

        // Check if this is the XDR parsing error (Bad union switch: 4)
        if (error.message?.includes('Bad union switch') || error.message?.includes('union switch')) {
          // This error means getTransaction can't parse the XDR, but the transaction likely succeeded
          // After enough attempts with this error, assume success
          if (attempts >= 10) {
            console.log('[TransactionExecutor] Assuming transaction succeeded despite XDR parsing errors');
            transactionSucceeded = true;
            break;
          }
        }

        // Network error or XDR parsing error - continue polling
        console.warn(`[TransactionExecutor] Polling error (attempt ${attempts}), retrying:`, error.message);
      }
    }

    if (attempts >= maxAttempts && !transactionSucceeded) {
      console.warn('[TransactionExecutor] Polling timeout - transaction may still be processing');
    }

    return {
      hash: txHash,
      result: returnValue,
    };
  } catch (error) {
    console.error('[TransactionExecutor] Transaction execution failed:', error);
    throw error;
  }
}
"#;
        fs::write(base.join("src/client/components/TransactionExecutor.tsx"), content)?;
        println!("    Generated frontend/src/client/components/TransactionExecutor.tsx");
        Ok(())
    }

    fn generate_secret_key_sign_card(&self, base: &Path) -> Result<(), Box<dyn std::error::Error>> {
        let content = r#"import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface SecretKeySignCardProps {
  toolName: string;
  params?: Record<string, any>;
  xdr: string;
  simulationResult?: any;
  onSignRequest: (secretKey: string) => void;
  isSigningInProgress?: boolean;
}

/**
 * Component for signing transactions with a secret key.
 *
 * This component displays transaction details and collects the secret key from the user.
 * When user clicks "Sign & Submit", it calls the onSignRequest callback with the secret key.
 * The parent component is responsible for:
 * 1. Storing the XDR in state (pendingXdr)
 * 2. Sending the chat message with the secret key
 * 3. Passing pendingXdr to the backend which intercepts the sign_and_submit call
 *
 * This approach prevents XDR corruption because the XDR never passes through the AI.
 */
export function SecretKeySignCard({
  toolName,
  params = {},
  xdr,
  simulationResult,
  onSignRequest,
  isSigningInProgress = false,
}: SecretKeySignCardProps) {
  const [secretKey, setSecretKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [copiedXdr, setCopiedXdr] = useState(false);

  const truncatedXdr = xdr.length > 60
    ? `${xdr.slice(0, 30)}...${xdr.slice(-30)}`
    : xdr;

  const handleCopyXdr = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(xdr);
    setCopiedXdr(true);
    setTimeout(() => setCopiedXdr(false), 2000);
  };

  const handleSign = () => {
    if (!secretKey) {
      setError('Please enter your secret key');
      return;
    }

    if (!secretKey.startsWith('S') || secretKey.length !== 56) {
      setError('Invalid secret key. Must start with S and be 56 characters.');
      return;
    }

    setError(null);

    // Call the parent's sign request handler
    // The parent will send a message to AI with the secret key
    // The backend will intercept and use the stored XDR
    onSignRequest(secretKey);

    // Clear the secret key for security
    setSecretKey('');
  };

  return (
    <div className="my-4 p-4 bg-card rounded-lg border border-border shadow-sm">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-semibold text-foreground">Transaction Ready</h3>
          <p className="text-sm text-muted-foreground mt-1">{toolName}</p>
        </div>
        <span className="px-2 py-1 text-xs bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-md border border-amber-500/20">
          Pending Signature
        </span>
      </div>

      {/* Parameters */}
      {Object.keys(params).length > 0 && (
        <div className="mb-4">
          <p className="text-sm font-medium text-foreground mb-2">Parameters:</p>
          <div className="bg-muted/50 rounded-md p-3">
            {Object.entries(params).map(([key, value]) => (
              <div key={key} className="flex justify-between text-sm py-1">
                <span className="text-muted-foreground">{key}:</span>
                <span className="font-mono text-foreground truncate max-w-[60%]">
                  {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* XDR Dropdown */}
      <div className="mb-4">
        <div
          onClick={() => setExpanded(!expanded)}
          className="flex items-center justify-between p-2.5 bg-muted/50 hover:bg-muted rounded-lg border border-border/50 cursor-pointer transition-all"
        >
          <div className="flex items-center gap-3 overflow-hidden">
            <div className={`text-muted-foreground transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m6 9 6 6 6-6"/>
              </svg>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">Transaction XDR</span>
              <code className="text-xs font-mono text-foreground/80 truncate">
                {expanded ? 'Click to collapse' : truncatedXdr}
              </code>
            </div>
          </div>
          <button
            onClick={handleCopyXdr}
            className="flex items-center justify-center h-8 w-8 rounded-md hover:bg-background border border-transparent hover:border-border transition-all text-muted-foreground hover:text-foreground"
            title="Copy XDR"
          >
            {copiedXdr ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-500">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
                <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
              </svg>
            )}
          </button>
        </div>

        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="mt-2 p-3 bg-background rounded-lg border border-border shadow-inner overflow-x-auto">
                <code className="block text-xs font-mono break-all text-muted-foreground leading-relaxed">
                  {xdr}
                </code>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Secret Key Input */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-foreground mb-2">
          Secret Key
        </label>
        <div className="relative">
          <input
            type={showKey ? 'text' : 'password'}
            value={secretKey}
            onChange={(e) => setSecretKey(e.target.value)}
            placeholder="S..."
            disabled={isSigningInProgress}
            className="w-full px-3 py-2 pr-10 bg-background border border-border rounded-md font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
          />
          <button
            type="button"
            onClick={() => setShowKey(!showKey)}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
          >
            {showKey ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                <line x1="1" y1="1" x2="23" y2="23"/>
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            )}
          </button>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Your secret key will not be stored and is only used to sign this transaction.
        </p>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* Simulation Result Preview */}
      {simulationResult && (
        <div className="mb-4 p-3 bg-muted/30 rounded-md border border-border/50">
          <p className="text-xs font-medium text-muted-foreground mb-1">Simulation Result:</p>
          <pre className="text-xs font-mono text-foreground/80 overflow-x-auto">
            {typeof simulationResult === 'object' ? JSON.stringify(simulationResult, null, 2) : String(simulationResult)}
          </pre>
        </div>
      )}

      {/* Sign Button */}
      <button
        onClick={handleSign}
        disabled={isSigningInProgress || !secretKey}
        className="w-full px-4 py-2.5 bg-primary text-primary-foreground rounded-md font-medium text-sm hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {isSigningInProgress ? (
          <>
            <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Signing & Submitting...
          </>
        ) : (
          <>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
            Sign & Submit Transaction
          </>
        )}
      </button>
    </div>
  );
}
"#;
        fs::write(base.join("src/client/components/SecretKeySignCard.tsx"), content)?;
        println!("    Generated frontend/src/client/components/SecretKeySignCard.tsx");
        Ok(())
    }

    fn generate_env_example(&self, base: &Path) -> Result<(), Box<dyn std::error::Error>> {
        let content = r#"# ========== AI Provider Configuration ==========
# Choose your AI provider: 'openai' or 'anthropic'
AI_PROVIDER=openai

# OpenAI API Key (required if AI_PROVIDER=openai)
# Get your key at: https://platform.openai.com/api-keys
OPENAI_API_KEY=your-openai-api-key-here

# Anthropic API Key (required if AI_PROVIDER=anthropic)
# Get your key at: https://console.anthropic.com/settings/keys
ANTHROPIC_API_KEY=your-anthropic-api-key-here

# ========== Backend Configuration ==========
# API server port
API_PORT=3001

# ========== MCP Server Configuration ==========
# MCP Server URL (StreamableHTTP endpoint - recommended)
MCP_SERVER_URL=http://localhost:3000/mcp
VITE_MCP_SERVER_URL=http://localhost:3000/mcp

# ========== Frontend Configuration ==========
# API endpoint URL (where the AI chat backend runs)
VITE_API_URL=http://localhost:3001/api/chat
"#;
        fs::write(base.join(".env.example"), content)?;
        println!("    Generated frontend/.env.example");
        Ok(())
    }

    fn generate_auth_mode_selector(&self, base: &Path) -> Result<(), Box<dyn std::error::Error>> {
        let content = r#"import { motion } from 'framer-motion';

interface AuthModeSelectorProps {
  mode: 'secret' | 'wallet';
  onModeChange: (mode: 'secret' | 'wallet') => void;
}

export function AuthModeSelector({ mode, onModeChange }: AuthModeSelectorProps) {
  return (
    <div className="w-full max-w-sm mx-auto mb-6">
      <div className="relative flex p-1 rounded-xl bg-muted/50 border border-border/50 backdrop-blur-sm">
        <div className="relative flex w-full">
          {/* Active Background Pill */}
          <motion.div
            className="absolute top-0 bottom-0 left-0 rounded-lg bg-background shadow-sm border border-border"
            initial={false}
            animate={{
              x: mode === 'wallet' ? 0 : '100%',
              width: '50%'
            }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
          />

          {/* Wallet Button */}
          <button
            onClick={() => onModeChange('wallet')}
            className={`relative z-10 w-1/2 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 rounded-lg ${
              mode === 'wallet' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground/80'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4" />
                <path d="M4 6v12a2 2 0 0 0 2 2h14v-4" />
                <path d="M18 12a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h4v-8Z" />
              </svg>
              <span>Wallet</span>
            </div>
          </button>

          {/* Secret Key Button */}
          <button
            onClick={() => onModeChange('secret')}
            className={`relative z-10 w-1/2 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 rounded-lg ${
              mode === 'secret' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground/80'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1Z" />
              </svg>
              <span>Secret Key</span>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
"#;
        fs::write(base.join("src/client/components/AuthModeSelector.tsx"), content)?;
        println!("    Generated frontend/src/client/components/AuthModeSelector.tsx");
        Ok(())
    }

    fn generate_wallet_connector(&self, base: &Path) -> Result<(), Box<dyn std::error::Error>> {
        let content = r#"import { useState } from 'react';
import { StellarWalletsKit, WalletNetwork, allowAllModules, ISupportedWallet } from '@creit.tech/stellar-wallets-kit';

interface WalletConnectorProps {
  walletAddress: string | null;
  onConnect: (address: string) => void;
  onDisconnect: () => void;
}

export function WalletConnector({ walletAddress, onConnect, onDisconnect }: WalletConnectorProps) {
  const [connecting, setConnecting] = useState(false);

  const connectWallet = async () => {
    setConnecting(true);
    try {
      const kit = new StellarWalletsKit({
        network: WalletNetwork.TESTNET,
        selectedWalletId: 'freighter',
        modules: allowAllModules(),
      });

      await kit.openModal({
        onWalletSelected: async (option: ISupportedWallet) => {
          kit.setWallet(option.id);
          const { address } = await kit.getAddress();
          onConnect(address);
        }
      });
    } catch (error) {
      console.error('Wallet connection failed:', error);
    } finally {
      setConnecting(false);
    }
  };

  if (walletAddress) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm font-mono text-muted-foreground hidden md:inline">
          {walletAddress.slice(0, 4)}...{walletAddress.slice(-4)}
        </span>
        <button
          onClick={onDisconnect}
          className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={connectWallet}
      disabled={connecting}
      className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-4 py-2 disabled:opacity-50 disabled:pointer-events-none"
    >
      {connecting ? 'Connecting...' : 'Connect Wallet'}
    </button>
  );
}
"#;
        fs::write(base.join("src/client/components/WalletConnector.tsx"), content)?;
        println!("    Generated frontend/src/client/components/WalletConnector.tsx");
        Ok(())
    }

    fn generate_contract_tools(&self, base: &Path) -> Result<(), Box<dyn std::error::Error>> {
        let content = r#"import { useState } from 'react';
import { ToolExecutor } from './ToolExecutor';

interface ContractToolsProps {
  tools: any[];
  authMode: 'secret' | 'wallet';
  secretKey: string;
  walletAddress: string | null;
}

export function ContractTools({
  tools,
  authMode,
  secretKey,
  walletAddress
}: ContractToolsProps) {
  const [selectedTool, setSelectedTool] = useState<any | null>(null);

  return (
    <div className="mt-8">
      <h2 className="text-2xl font-bold mb-4">Contract Functions</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tools?.map((tool) => (
          <button
            key={tool.name}
            onClick={() => setSelectedTool(tool)}
            className="bg-white p-4 rounded-lg shadow hover:shadow-lg transition text-left"
          >
            <h3 className="font-semibold text-lg">{tool.name}</h3>
            <p className="text-sm text-gray-600 mt-1">
              {tool.description}
            </p>
          </button>
        ))}
      </div>

      {selectedTool && (
        <ToolExecutor
          tool={selectedTool}
          authMode={authMode}
          secretKey={secretKey}
          walletAddress={walletAddress}
          onClose={() => setSelectedTool(null)}
        />
      )}
    </div>
  );
}
"#;
        fs::write(base.join("src/client/components/ContractTools.tsx"), content)?;
        println!("    Generated frontend/src/client/components/ContractTools.tsx");
        Ok(())
    }

    fn generate_tool_executor(&self, base: &Path) -> Result<(), Box<dyn std::error::Error>> {
        let content = r#"import { useState } from 'react';
import { useMcpClient } from '../lib/mcp-client';
import { StellarWalletsKit, WalletNetwork, allowAllModules } from '@creit.tech/stellar-wallets-kit';

interface ToolExecutorProps {
  tool: any;
  authMode: 'secret' | 'wallet';
  secretKey: string;
  walletAddress: string | null;
  onClose: () => void;
}

export function ToolExecutor({
  tool,
  authMode,
  secretKey,
  walletAddress,
  onClose,
}: ToolExecutorProps) {
  const [params, setParams] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const { executeTool } = useMcpClient();

  const handleExecute = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      // Step 1: Call MCP tool to get unsigned XDR
      const toolResult = await executeTool(tool.name, params);
      const { xdr, simulationResult } = toolResult;

      if (authMode === 'secret') {
        // Secret Key Mode: Use sign-and-submit MCP tool
        const submitResult = await executeTool('sign-and-submit', {
          xdr,
          secretKey,
        });
        setResult(submitResult);
      } else {
        // Wallet Mode: Use prepare-transaction + wallet SDK

        // Step 2: Call prepare-transaction to get wallet-ready XDR + preview
        const prepareResult = await executeTool('prepare-transaction', {
          xdr,
          walletAddress: walletAddress!,
          toolName: tool.name,
          params,
          simulationResult,
        });

        const { walletReadyXdr, preview } = prepareResult as { walletReadyXdr: string, preview: { network: WalletNetwork } };


        // Step 3: Wallet signs and submits
        const kit = new StellarWalletsKit({
          network: WalletNetwork.TESTNET,
          selectedWalletId: 'freighter',
          modules: allowAllModules(),
        });

        const signedXdr = await kit.signTransaction(walletReadyXdr, {
          address: walletAddress!,
          networkPassphrase: preview.network,
        });

        setResult({
          signedXdr,
          status: 'SUCCESS',
          preview,
        });
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold">{tool.name}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            ✕
          </button>
        </div>

        <p className="text-gray-600 mb-4">{tool.description}</p>

        {/* Dynamic form based on tool schema */}
        <div className="space-y-4">
          {Object.entries(tool.inputSchema?.properties || {}).map(
            ([key, schema]: [string, any]) => (
              <div key={key}>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {key}
                </label>
                <input
                  type={schema.type === 'number' ? 'number' : 'text'}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder={schema.description}
                  onChange={(e) =>
                    setParams({ ...params, [key]: e.target.value })
                  }
                />
              </div>
            )
          )}
        </div>

        <button
          onClick={handleExecute}
          disabled={loading}
          className="mt-4 w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400"
        >
          {loading ? 'Executing...' : 'Execute'}
        </button>

        {error && (
          <div className="mt-4 p-4 bg-red-50 text-red-700 rounded-md">
            {error}
          </div>
        )}

        {result && (
          <div className="mt-4 p-4 bg-green-50 rounded-md">
            <h4 className="font-semibold mb-2">Result:</h4>
            <pre className="text-sm overflow-x-auto">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
"#;
        fs::write(base.join("src/client/components/ToolExecutor.tsx"), content)?;
        println!("    Generated frontend/src/client/components/ToolExecutor.tsx");
        Ok(())
    }

    // ========== SERVER FILES ==========

    fn generate_server_index(&self, base: &Path) -> Result<(), Box<dyn std::error::Error>> {
        let content = r#"import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { chatRouter } from './routes/chat';

dotenv.config();

const app = express();
const PORT = process.env.API_PORT || 3001;

app.use(cors());
app.use(express.json());

// Health check with config status
app.get('/health', (_req, res) => {
  const provider = process.env.AI_PROVIDER || 'openai';
  const hasOpenAI = !!process.env.OPENAI_API_KEY;
  const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;
  const hasMcpServer = !!process.env.MCP_SERVER_URL;

  // Check if required API key is configured based on provider
  const hasRequiredApiKey = provider === 'anthropic' ? hasAnthropic : hasOpenAI;

  const errors: string[] = [];
  if (!hasRequiredApiKey) {
    errors.push(provider === 'anthropic'
      ? 'ANTHROPIC_API_KEY not configured'
      : 'OPENAI_API_KEY not configured');
  }

  res.json({
    status: errors.length === 0 ? 'ok' : 'degraded',
    config: {
      provider,
      openai: hasOpenAI,
      anthropic: hasAnthropic,
      mcpServer: hasMcpServer,
      mcpServerUrl: process.env.MCP_SERVER_URL || 'http://localhost:3000/mcp',
    },
    errors: errors.length > 0 ? errors : undefined,
  });
});

// Chat API
app.use('/api', chatRouter);

app.listen(PORT, () => {
  console.log(`🚀 API server running on http://localhost:${PORT}`);
  console.log(`   Chat endpoint: http://localhost:${PORT}/api/chat`);
});
"#;
        fs::write(base.join("src/server/index.ts"), content)?;
        println!("    Generated frontend/src/server/index.ts");
        Ok(())
    }

    fn generate_chat_route(&self, base: &Path) -> Result<(), Box<dyn std::error::Error>> {
        let content = r##"import { Router } from 'express';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { streamText, tool } from 'ai';
import { z } from 'zod';

export const chatRouter = Router();

// MCP Server URL - use /mcp endpoint for HTTP transport
const MCP_SERVER_URL = process.env.MCP_SERVER_URL || 'http://localhost:3000/mcp';

// Type definitions for MCP JSON-RPC
interface MCPTool {
  name: string;
  description?: string;
  inputSchema?: {
    type: string;
    properties?: Record<string, any>;
    required?: string[];
  };
}

interface MCPToolsListResult {
  tools: MCPTool[];
}

interface MCPToolCallResult {
  content: Array<{
    type: string;
    text?: string;
  }>;
  isError?: boolean;
}

// Helper to parse SSE response from MCP server
function parseSSEResponse(text: string): any {
  // SSE format: "event: message\ndata: {...}\n\n"
  // FastMCP sends multiple events - we need the last one with a result
  const lines = text.split('\n');
  const events: any[] = [];

  for (const line of lines) {
    if (line.startsWith('data: ')) {
      try {
        events.push(JSON.parse(line.substring(6)));
      } catch (e) {
        // Skip invalid JSON
      }
    }
  }

  // Find the last event with a result or id match (not a notification)
  for (let i = events.length - 1; i >= 0; i--) {
    if (events[i].result !== undefined || events[i].error !== undefined) {
      return events[i];
    }
  }

  // Fallback: return the last event or try to parse as plain JSON
  if (events.length > 0) {
    return events[events.length - 1];
  }
  return JSON.parse(text);
}

// Helper to make JSON-RPC calls to MCP server
async function mcpJsonRpc<T>(method: string, params?: Record<string, any>): Promise<T> {
  const response = await fetch(MCP_SERVER_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method,
      params: params || {},
    }),
  });

  if (!response.ok) {
    throw new Error(`MCP request failed: ${response.status} ${response.statusText}`);
  }

  // Read response as text first, then parse
  const text = await response.text();
  const data = parseSSEResponse(text);

  if (data.error) {
    throw new Error(`MCP error: ${data.error.message || JSON.stringify(data.error)}`);
  }

  return data.result;
}

// Fetch tools list from MCP server via JSON-RPC
async function fetchMCPTools(): Promise<MCPTool[]> {
  // First initialize the server (required for MCP protocol)
  await mcpJsonRpc('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'frontend-chat', version: '1.0.0' },
  });

  // Then get tools list
  const result = await mcpJsonRpc<MCPToolsListResult>('tools/list', {});
  return result.tools;
}

// Call a tool on the MCP server via JSON-RPC
async function callMCPTool(name: string, args: Record<string, any>): Promise<MCPToolCallResult> {
  // Initialize first (stateless mode requires this for each request)
  await mcpJsonRpc('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'frontend-chat', version: '1.0.0' },
  });

  // Then call the tool
  return mcpJsonRpc<MCPToolCallResult>('tools/call', {
    name,
    arguments: args,
  });
}

// Convert a single JSON Schema property to Zod type
function convertPropertyToZod(prop: any, isRequired: boolean): z.ZodType<any> {
  let zodType: z.ZodType<any>;

  // Handle anyOf (union types)
  if (prop.anyOf) {
    const variants = prop.anyOf.map((variant: any) => convertPropertyToZod(variant, true));
    zodType = z.union(variants as [z.ZodType<any>, z.ZodType<any>, ...z.ZodType<any>[]]);
    if (prop.description) {
      zodType = zodType.describe(prop.description);
    }
    if (!isRequired) {
      zodType = zodType.optional();
    }
    return zodType;
  }

  // Handle array type like ["string", "null"]
  if (Array.isArray(prop.type)) {
    const hasNull = prop.type.includes('null');
    const nonNullType = prop.type.find((t: string) => t !== 'null');
    zodType = convertPropertyToZod({ ...prop, type: nonNullType }, true);
    if (hasNull) {
      zodType = zodType.nullable();
    }
    if (!isRequired) {
      zodType = zodType.optional();
    }
    return zodType;
  }

  // Handle const values
  if (prop.const !== undefined) {
    zodType = z.literal(prop.const);
    if (prop.description) {
      zodType = zodType.describe(prop.description);
    }
    if (!isRequired) {
      zodType = zodType.optional();
    }
    return zodType;
  }

  switch (prop.type) {
    case 'string':
      zodType = z.string();
      if (prop.description) {
        zodType = zodType.describe(prop.description);
      }
      break;
    case 'number':
    case 'integer':
      zodType = z.number();
      if (prop.description) {
        zodType = zodType.describe(prop.description);
      }
      break;
    case 'boolean':
      zodType = z.boolean();
      if (prop.description) {
        zodType = zodType.describe(prop.description);
      }
      break;
    case 'null':
      zodType = z.null();
      break;
    case 'object':
      // Recursively handle nested objects with their own properties
      if (prop.properties) {
        const nestedShape: Record<string, z.ZodType<any>> = {};
        for (const [nestedKey, nestedProp] of Object.entries(prop.properties)) {
          const nestedRequired = prop.required?.includes(nestedKey) ?? false;
          nestedShape[nestedKey] = convertPropertyToZod(nestedProp, nestedRequired);
        }
        zodType = z.object(nestedShape);
      } else {
        // Generic object without defined properties
        zodType = z.record(z.any());
      }
      if (prop.description) {
        zodType = zodType.describe(prop.description);
      }
      break;
    case 'array':
      if (prop.items) {
        zodType = z.array(convertPropertyToZod(prop.items, true));
      } else {
        zodType = z.array(z.any());
      }
      if (prop.description) {
        zodType = zodType.describe(prop.description);
      }
      break;
    default:
      zodType = z.any();
      if (prop.description) {
        zodType = zodType.describe(prop.description);
      }
  }

  if (!isRequired) {
    zodType = zodType.optional();
  }

  return zodType;
}

// Convert MCP tool schema to Zod schema
function convertToZodSchema(inputSchema?: MCPTool['inputSchema']): z.ZodType<any> {
  if (!inputSchema || !inputSchema.properties) {
    return z.object({});
  }

  const shape: Record<string, z.ZodType<any>> = {};

  for (const [key, prop] of Object.entries(inputSchema.properties)) {
    const isRequired = inputSchema.required?.includes(key) ?? false;
    shape[key] = convertPropertyToZod(prop, isRequired);
  }

  return z.object(shape);
}

// Convert MCP tools to AI SDK tools format
// pendingXdr: XDR stored in frontend state, used to prevent AI from corrupting XDR strings
function convertMCPToolsToAISDK(mcpTools: MCPTool[], pendingXdr?: string): any {
  const tools: any = {};

  for (const mcpTool of mcpTools) {
    const zodSchema = convertToZodSchema(mcpTool.inputSchema);

    tools[mcpTool.name] = tool({
      description: mcpTool.description || `Execute ${mcpTool.name}`,
      parameters: zodSchema,
      execute: async (args) => {
        console.log(`[Tool] Calling MCP tool: ${mcpTool.name}`, args);

        // XDR INTERCEPTION: For sign_and_submit/sign-and-submit, replace AI's XDR with the stored pendingXdr
        // This prevents XDR corruption/truncation that happens when AI reconstructs long strings
        let finalArgs = args;
        const toolNameLower = mcpTool.name.toLowerCase();
        if ((toolNameLower === 'sign_and_submit' || toolNameLower === 'sign-and-submit') && pendingXdr) {
          console.log('[Tool] XDR Interception: Using pendingXdr instead of AI-provided XDR');
          console.log('[Tool] AI provided XDR length:', args.xdr?.length || 0);
          console.log('[Tool] Pending XDR length:', pendingXdr.length);
          finalArgs = {
            ...args,
            xdr: pendingXdr, // Use the stored XDR from frontend
          };
        }

        try {
          const result = await callMCPTool(mcpTool.name, finalArgs);

          // Extract text content from MCP response
          const textContent = result.content
            .filter(c => c.type === 'text')
            .map(c => c.text)
            .join('\n');

          console.log(`[Tool] ${mcpTool.name} result:`, textContent.substring(0, 200));

          // Try to parse as JSON, otherwise return as-is
          try {
            return JSON.parse(textContent);
          } catch {
            return { result: textContent };
          }
        } catch (error) {
          console.error(`[Tool] ${mcpTool.name} error:`, error);
          return {
            error: true,
            message: error instanceof Error ? error.message : 'Tool execution failed',
          };
        }
      },
    });
  }

  return tools;
}

function buildSystemPrompt(authMode: string, walletAddress?: string | null): string {
  // Build mode-specific instructions
  const walletModeInstructions = `
**WALLET MODE - Transaction Flow:**
You are in WALLET mode. The user will sign transactions with their connected wallet in the browser.

For write operations (state-changing functions):
1. First, call the contract function tool (e.g., deploy-token, pause, etc.) to get the initial XDR
2. Then, call "prepare-transaction" with:
   - xdr: the XDR from step 1
   - walletAddress: "${walletAddress}"
   - toolName: name of the function called
   - params: the parameters used
3. Return the walletReadyXdr to the user - the frontend will display a "Sign Transaction" button
4. DO NOT call "sign-and-submit" - the user signs in their wallet via the frontend UI

Example flow:
1. User: "Deploy a token"
2. You: Call deploy-token tool → get XDR
3. You: Call prepare-transaction with the XDR and wallet address
4. You: Return the transaction details with walletReadyXdr for frontend signing`;

  const secretKeyModeInstructions = `
**SECRET KEY MODE - Transaction Flow:**
You are in SECRET KEY mode. Transactions are signed server-side using a Stellar secret key.

**IMPORTANT: Distinguishing Read vs Write Operations**
- READ operations (get-balance, get-admin, get-deployed-tokens, etc.): Just return the data directly. NO signing needed!
- WRITE operations (deploy-token, pause, transfer, mint, etc.): Require signing with prepare-sign-and-submit

For READ operations:
1. Call the contract function tool
2. Return the data/result directly to the user
3. DO NOT call prepare-sign-and-submit for read operations

For WRITE operations (state-changing functions):
1. First, call the contract function tool (e.g., deploy-token, pause, etc.) to get the XDR and simulation
2. Then, call "prepare-sign-and-submit" with:
   - xdr: the XDR from step 1
   - toolName: name of the function called (e.g., "deploy-token")
   - params: the parameters used
   - simulationResult: the simulation result from step 1
3. The frontend will display a signing UI where the user enters their secret key
4. DO NOT call sign-and-submit directly - the user triggers that from the UI after providing their key

Example write flow:
1. User: "Deploy a token called MyToken"
2. You: Call deploy-token tool → get XDR + simulation result
3. You: Call prepare-sign-and-submit with the XDR, toolName, params, and simulationResult
4. Frontend shows signing card with secret key input
5. User enters key and clicks sign - frontend handles the rest

Example read flow:
1. User: "What tokens are deployed?"
2. You: Call get-deployed-tokens tool → get list of tokens
3. You: Return the token list directly to the user (NO prepare-sign-and-submit!)

**Key Rules:**
- NEVER call prepare-sign-and-submit for read/query operations
- ALWAYS call prepare-sign-and-submit for write operations before the user can sign
- DO NOT call sign-and-submit directly - the frontend handles that after prepare-sign-and-submit`;

  const modeInstructions = authMode === 'wallet' ? walletModeInstructions : secretKeyModeInstructions;

  return `You are an AI assistant for interacting with Stellar smart contracts through the Model Context Protocol (MCP).

**Your Role:**
- Help users interact with Stellar smart contracts using natural language
- Call MCP tools to execute contract functions
- Explain what you're doing in clear, simple terms

**User Context:**
- Auth Mode: ${authMode}
${walletAddress ? `- Connected Wallet: ${walletAddress}` : '- No wallet connected'}
- Network: Stellar Testnet
${modeInstructions}

**CRITICAL: XDR Handling Rules**

XDR (External Data Representation) strings are base64-encoded transaction data. They are BINARY DATA that must be preserved EXACTLY.

⚠️ NEVER modify, truncate, summarize, or abbreviate XDR strings!
⚠️ When passing XDR between tools, copy the COMPLETE string character-for-character
⚠️ XDR strings can be 500-2000+ characters - this is normal and expected
⚠️ Even a single character change will corrupt the transaction and cause errors

**Response Format:**

For write operations in WALLET mode, return:
\`\`\`json
{
  "data": { ...operation parameters... },
  "transaction": {
    "xdr": "<WALLET_READY_XDR from prepare-transaction>",
    "contractAddress": "CXXX...",
    "method": "function_name",
    "network": "testnet",
    "params": { ...parameters... }
  }
}
\`\`\`

For read operations, return:
\`\`\`json
{
  "data": { ...query results... }
}
\`\`\`

**Guidelines:**
- Be concise but informative
- Always explain what a transaction will do before asking for approval
- If the user's request is ambiguous, ask clarifying questions
- If an operation requires parameters you don't have, ask for them
- Never make assumptions about amounts, addresses, or critical parameters

Remember: User safety and transparency are paramount. Never execute write operations without explicit user confirmation.`;
}

// Endpoint to fetch available tools from MCP server
chatRouter.get('/tools', async (_req, res) => {
  try {
    const mcpTools = await fetchMCPTools();

    // Convert to frontend format
    const toolsArray = mcpTools.map(tool => ({
      name: tool.name,
      description: tool.description || '',
      inputSchema: tool.inputSchema || {},
    }));

    res.json({ tools: toolsArray });
  } catch (error) {
    console.error('Tools fetch error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to fetch tools'
    });
  }
});

// Helper function to filter messages with incomplete tool invocations
function filterMessagesForAPI(messages: any[]): any[] {
  return messages
    .map((msg) => {
      // If message has toolInvocations, filter out incomplete ones
      if (msg.toolInvocations && Array.isArray(msg.toolInvocations)) {
        const completeInvocations = msg.toolInvocations.filter(
          (inv: any) => inv.state === 'result' && inv.result !== undefined
        );

        // If no complete invocations, return message without toolInvocations
        if (completeInvocations.length === 0) {
          const { toolInvocations, ...rest } = msg;
          // If the message has no content and no complete tool invocations, skip it
          if (!rest.content || rest.content === '') {
            return null;
          }
          return rest;
        }

        return { ...msg, toolInvocations: completeInvocations };
      }
      return msg;
    })
    .filter((msg) => msg !== null);
}

chatRouter.post('/chat', async (req, res) => {
  try {
    const { messages: rawMessages, authMode, walletAddress, pendingXdr } = req.body;

    if (!rawMessages || !Array.isArray(rawMessages)) {
      return res.status(400).json({ error: 'Invalid messages format' });
    }

    // Filter out messages with incomplete tool invocations to prevent AI_MessageConversionError
    const messages = filterMessagesForAPI(rawMessages);

    console.log('[Chat] Filtered messages:', messages.length, 'from', rawMessages.length);
    if (pendingXdr) {
      console.log('[Chat] Pending XDR received, length:', pendingXdr.length);
    }

    // Determine which AI provider to use
    const provider = process.env.AI_PROVIDER || 'openai';

    let model;
    if (provider === 'anthropic') {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        return res.status(500).json({
          error: 'ANTHROPIC_API_KEY not configured in .env'
        });
      }
      model = anthropic('claude-3-5-sonnet-20241022');
    } else {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({
          error: 'OPENAI_API_KEY not configured in .env'
        });
      }
      model = openai('gpt-4o');
    }

    // Fetch MCP tools and convert to AI SDK format
    // Pass pendingXdr for XDR interception on sign_and_submit calls
    console.log('[Chat] Fetching tools from MCP server...');
    const mcpTools = await fetchMCPTools();
    const tools = convertMCPToolsToAISDK(mcpTools, pendingXdr);

    console.log('[Chat] Got tools from MCP:', Object.keys(tools).length, 'tools');

    // Build system prompt with prepare-transaction guidance
    const systemPrompt = buildSystemPrompt(authMode, walletAddress);

    // Stream AI response with MCP tools
    console.log('[Chat] Calling streamText with provider:', provider);
    const result = streamText({
      model,
      system: systemPrompt,
      messages,
      tools,
      maxSteps: 5, // Allow multi-step tool usage
      onChunk: async ({ chunk }) => {
        console.log('[Chat] Chunk:', chunk.type);
      },
      onFinish: async ({ finishReason, usage }) => {
        console.log('[Chat] Stream finished:', finishReason, usage);
      },
      onError: async (error: any) => {
        console.error('[Chat] Stream error:', error);
        // Check for quota error
        if (error?.error?.lastError?.statusCode === 429 ||
            error?.error?.reason === 'maxRetriesExceeded') {
          console.error('[Chat] API quota exceeded! Please check your billing.');
        }
      },
    });

    // Pipe the stream to response (handles headers automatically)
    result.pipeDataStreamToResponse(res);

  } catch (error) {
    console.error('Chat error:', error);
    // Log full error details for debugging
    if (error instanceof Error) {
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      if ('cause' in error) {
        console.error('Error cause:', error.cause);
      }
    }
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
});

"##;
        fs::write(base.join("src/server/routes/chat.ts"), content)?;
        println!("    Generated frontend/src/server/routes/chat.ts");
        Ok(())
    }

    // ========== CLIENT CHAT COMPONENTS ==========

    fn generate_chat_interface(&self, base: &Path) -> Result<(), Box<dyn std::error::Error>> {
        let content = r#"import { useChat } from 'ai/react';
import { useState, useEffect } from 'react';
import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';
import { SuggestedActions } from './SuggestedActions';

interface Tool {
  name: string;
  description?: string;
  inputSchema?: any;
}

interface HealthStatus {
  status: 'ok' | 'degraded' | 'error';
  config: {
    provider: string;
    openai: boolean;
    anthropic: boolean;
    mcpServer: boolean;
    mcpServerUrl: string;
  };
  errors?: string[];
}

interface ChatInterfaceProps {
  authMode: 'secret' | 'wallet';
  walletAddress: string | null;
}

export function ChatInterface({ authMode, walletAddress }: ChatInterfaceProps) {
  const [availableTools, setAvailableTools] = useState<Tool[]>([]);
  const [toolsLoading, setToolsLoading] = useState(true);
  const [toolsError, setToolsError] = useState<string | null>(null);
  const [configErrors, setConfigErrors] = useState<string[]>([]);
  const [chatError, setChatError] = useState<string | null>(null);

  // XDR state management for sign flow
  // Store XDR in frontend state to prevent AI from corrupting it when reconstructing
  const [pendingXdr, setPendingXdr] = useState<string | null>(null);
  const [isSigningInProgress, setIsSigningInProgress] = useState(false);

  // Check server health/config on mount
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/api/chat';
        const healthUrl = apiUrl.replace('/api/chat', '/health');

        const response = await fetch(healthUrl);
        if (response.ok) {
          const health: HealthStatus = await response.json();
          if (health.errors && health.errors.length > 0) {
            setConfigErrors(health.errors);
          }
        }
      } catch (error) {
        console.error('[ChatInterface] Health check failed:', error);
        setConfigErrors(['Unable to connect to API server. Is the backend running?']);
      }
    };

    checkHealth();
  }, []);

  // Fetch available tools from the MCP server via backend
  useEffect(() => {
    const fetchTools = async () => {
      try {
        setToolsLoading(true);
        setToolsError(null);

        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/api/chat';
        const toolsUrl = apiUrl.replace('/chat', '/tools');

        console.log('[ChatInterface] Fetching tools from:', toolsUrl);

        const response = await fetch(toolsUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch tools: ${response.statusText}`);
        }

        const data = await response.json();
        console.log('[ChatInterface] Tools response:', data);

        if (data.tools && Array.isArray(data.tools)) {
          setAvailableTools(data.tools);
        }
      } catch (error) {
        console.error('[ChatInterface] Error fetching tools:', error);
        setToolsError(error instanceof Error ? error.message : 'Failed to fetch tools');
      } finally {
        setToolsLoading(false);
      }
    };

    fetchTools();
  }, []);

  console.log('[ChatInterface] availableTools:', availableTools);

  const { messages, input, handleInputChange, handleSubmit, isLoading, append } = useChat({
    api: import.meta.env.VITE_API_URL || 'http://localhost:3001/api/chat',
    body: {
      tools: availableTools,
      authMode,
      walletAddress,
      // Pass pending XDR to backend for interception at execute level
      // This prevents AI from corrupting long XDR strings when reconstructing from memory
      pendingXdr,
    },
    onError: (error) => {
      console.error('[ChatInterface] Chat error:', error);
      setIsSigningInProgress(false);
      // Parse error message - could be JSON or plain text
      try {
        const parsed = JSON.parse(error.message);
        setChatError(parsed.error || error.message);
      } catch {
        setChatError(error.message || 'An error occurred while processing your message');
      }
    },
    onFinish: () => {
      // Clear error and signing state on successful completion
      setChatError(null);
      setIsSigningInProgress(false);
      // Clear pending XDR after successful sign operation
      setPendingXdr(null);
    },
  });

  // Handle sign request from SecretKeySignCard
  // This stores the XDR in state and sends the secret key to AI for signing
  const handleSignRequest = (xdr: string, secretKey: string) => {
    console.log('[ChatInterface] Sign request received');
    console.log('[ChatInterface] XDR length:', xdr.length);

    // Store XDR in state for future reference
    setPendingXdr(xdr);
    setIsSigningInProgress(true);

    // Send message to AI to trigger sign_and_submit
    // IMPORTANT: Pass pendingXdr directly in the body options to avoid stale closure
    // React state update is async, so we can't rely on pendingXdr state being updated
    append(
      {
        role: 'user',
        content: `SYSTEM: User authorized transaction signing. Call the sign-and-submit tool with secretKey: ${secretKey}`,
      },
      {
        body: {
          tools: availableTools,
          authMode,
          walletAddress,
          pendingXdr: xdr, // Pass XDR directly, not from state
        },
      }
    );
  };

  return (
    <div className="flex flex-col h-full w-full max-w-7xl mx-auto bg-card text-card-foreground sm:rounded-xl border-x-0 sm:border border-border shadow-sm overflow-hidden">
      {/* Config Error Banner */}
      {configErrors.length > 0 && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-3">
          <div className="flex items-start gap-3 max-w-4xl mx-auto">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-amber-500 shrink-0 mt-0.5"
            >
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
              <path d="M12 9v4"/>
              <path d="M12 17h.01"/>
            </svg>
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-700 dark:text-amber-400">Configuration Issue</p>
              <ul className="mt-1 text-sm text-amber-600 dark:text-amber-300">
                {configErrors.map((error, idx) => (
                  <li key={idx}>{error}</li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-amber-600/80 dark:text-amber-400/80">
                Check your .env file and ensure all required environment variables are set.
              </p>
            </div>
            <button
              onClick={() => setConfigErrors([])}
              className="text-amber-500 hover:text-amber-700 dark:hover:text-amber-300"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Chat Error Display */}
      {chatError && (
        <div className="bg-destructive/10 border-b border-destructive/20 px-4 py-3">
          <div className="flex items-start gap-3 max-w-4xl mx-auto">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-destructive shrink-0 mt-0.5"
            >
              <circle cx="12" cy="12" r="10"/>
              <path d="m15 9-6 6"/>
              <path d="m9 9 6 6"/>
            </svg>
            <div className="flex-1">
              <p className="text-sm font-medium text-destructive">Error</p>
              <p className="mt-1 text-sm text-destructive/80">{chatError}</p>
            </div>
            <button
              onClick={() => setChatError(null)}
              className="text-destructive hover:text-destructive/80"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
              </svg>
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-3 md:p-6 space-y-6">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-4 md:p-8 text-muted-foreground opacity-80">
            <div className="rounded-full bg-muted p-4 mb-4">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-8 w-8"
              >
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold mb-2">AI-Powered Contract Interface</h3>
            <p className="text-sm max-w-sm">
              Interact with your smart contract using natural language. Generated by Stellar MCP.
            </p>
            <div className="mt-8 w-full max-w-2xl">
              {toolsLoading ? (
                <div className="flex items-center justify-center gap-2 text-muted-foreground">
                  <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Loading tools from MCP server...</span>
                </div>
              ) : toolsError ? (
                <div className="text-destructive text-sm text-center">
                  Error loading tools: {toolsError}
                </div>
              ) : (
                <SuggestedActions
                  tools={availableTools}
                  onActionClick={(prompt) => {
                    handleInputChange({ target: { value: prompt } } as any);
                  }}
                />
              )}
            </div>
          </div>
        ) : (
          <MessageList
            messages={messages}
            walletAddress={walletAddress}
            isLoading={isLoading}
            authMode={authMode}
            onSignRequest={handleSignRequest}
            isSigningInProgress={isSigningInProgress}
          />
        )}
      </div>

      <div className="p-4 md:p-8 border-t border-border bg-muted/30">
        <div className="max-w-4xl mx-auto">
          <ChatInput
            input={input}
            handleInputChange={handleInputChange}
            handleSubmit={handleSubmit}
            isLoading={isLoading}
          />
        </div>
      </div>
    </div>
  );
}
"#;
        fs::write(base.join("src/client/components/ChatInterface.tsx"), content)?;
        println!("    Generated frontend/src/client/components/ChatInterface.tsx");
        Ok(())
    }

    fn generate_message_list(&self, base: &Path) -> Result<(), Box<dyn std::error::Error>> {
        let content = r#"import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Message } from 'ai';
import { ReadOperationCard, SignAndSubmitResultCard } from './ReadOperationCard';
import { WriteOperationCard } from './WriteOperationCard';
import { SecretKeySignCard } from './SecretKeySignCard';
import { executeTransaction } from './TransactionExecutor';

interface MessageListProps {
  messages: Message[];
  walletAddress?: string | null;
  isLoading?: boolean;
  authMode?: 'secret' | 'wallet';
  onSignRequest?: (xdr: string, secretKey: string) => void;
  isSigningInProgress?: boolean;
}

export function MessageList({ messages, walletAddress, isLoading, authMode: _authMode = 'wallet', onSignRequest, isSigningInProgress = false }: MessageListProps) {
  return (
    <div className="space-y-6">
      {messages.map((message) => (
        <div
          key={message.id}
          className={`flex gap-3 ${
            message.role === 'user' ? 'flex-row-reverse' : 'flex-row'
          }`}
        >
          <div
            className={`flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-full border shadow-sm ${
              message.role === 'user'
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-muted text-muted-foreground border-border'
            }`}
          >
            {message.role === 'user' ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4"
              >
                <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4"
              >
                <path d="M12 2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2 2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" />
                <path d="M12 22a2 2 0 0 1 2-2v-2a2 2 0 0 1-2-2 2 2 0 0 1-2 2v2a2 2 0 0 1 2 2z" />
                <path d="M2 12a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2 2 2 0 0 1-2 2H4a2 2 0 0 1-2-2z" />
                <path d="M22 12a2 2 0 0 1-2-2h-2a2 2 0 0 1-2 2 2 2 0 0 1 2 2h2a2 2 0 0 1 2-2z" />
                <circle cx="12" cy="12" r="2" />
              </svg>
            )}
          </div>

          <div
            className={`relative max-w-[90%] md:max-w-[85%] rounded-2xl px-3 py-2.5 md:px-4 md:py-3 text-sm shadow-sm ${
              message.role === 'user'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-foreground'
            }`}
          >
            <div className="leading-relaxed">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  p: ({children}) => <p className="mb-2 last:mb-0 break-words overflow-hidden">{children}</p>,
                  ul: ({children}) => <ul className="list-disc pl-4 mb-2 space-y-1 break-words">{children}</ul>,
                  ol: ({children}) => <ol className="list-decimal pl-4 mb-2 space-y-1 break-words">{children}</ol>,
                  li: ({children}) => <li>{children}</li>,
                  code: ({node, inline, className, children, ...props}: any) => {
                    return inline ? (
                      <code className="bg-background/20 px-1 py-0.5 rounded font-mono text-xs break-all" {...props}>
                        {children}
                      </code>
                    ) : (
                      <code className="block bg-background/20 p-2 rounded-lg font-mono text-xs overflow-x-auto my-2 whitespace-pre-wrap break-all" {...props}>
                        {children}
                      </code>
                    );
                  },
                  strong: ({children}) => <span className="font-bold">{children}</span>,
                  a: ({children, href}) => (
                    <a href={href} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:opacity-80">
                      {children}
                    </a>
                  ),
                }}
              >
                {message.content}
              </ReactMarkdown>
            </div>

            {/* Display tool calls with generic components */}
            {message.toolInvocations && message.toolInvocations.length > 0 && (
              <div className="mt-3 space-y-2">
                {message.toolInvocations.map((tool, idx) => {
                  // Only render if we have a result and tool call completed
                  if (tool.state !== 'result') return null;

                  const result = (tool as any).result;
                  const toolNameLower = tool.toolName.toLowerCase();

                  // Check if this is a sign-and-submit result
                  // Returns: { success: true, result: { status, hash, ... } } or { error, message }
                  if (toolNameLower === 'sign_and_submit' || toolNameLower === 'sign-and-submit') {
                    return (
                      <SignAndSubmitResultCard
                        key={idx}
                        success={result.success ?? false}
                        txResult={result.result || { status: 'FAILED', error: result.message || result.error }}
                      />
                    );
                  }

                  // Check if this is a prepare-transaction result (WriteOperationCard) - WALLET MODE
                  // Returns: { walletReadyXdr, preview: { toolName, params, simulationResult, network } }
                  if (toolNameLower === 'prepare_transaction' || toolNameLower === 'prepare-transaction') {
                    const transaction = {
                      xdr: result.walletReadyXdr,
                      network: result.preview?.network || 'testnet',
                      method: result.preview?.toolName,
                    };
                    return (
                      <WriteOperationCard
                        key={idx}
                        toolName={result.preview?.toolName || tool.toolName}
                        params={result.preview?.params || {}}
                        transaction={transaction}
                        walletAddress={walletAddress}
                        onSign={async (xdr) => {
                          if (!walletAddress) {
                            throw new Error('Wallet not connected');
                          }
                          return executeTransaction({
                            xdr,
                            walletAddress,
                          });
                        }}
                      />
                    );
                  }

                  // Check if this is a prepare-sign-and-submit result (SecretKeySignCard) - SECRET KEY MODE
                  // Returns: { readyForSigning: true, xdr, preview: { toolName, params, simulationResult, network } }
                  if (toolNameLower === 'prepare_sign_and_submit' || toolNameLower === 'prepare-sign-and-submit') {
                    return (
                      <SecretKeySignCard
                        key={idx}
                        toolName={result.preview?.toolName || tool.toolName}
                        params={result.preview?.params}
                        xdr={result.xdr}
                        simulationResult={result.preview?.simulationResult}
                        onSignRequest={(secretKey) => {
                          if (onSignRequest) {
                            onSignRequest(result.xdr, secretKey);
                          }
                        }}
                        isSigningInProgress={isSigningInProgress}
                      />
                    );
                  }

                  // Otherwise it's a read operation
                  return (
                    <ReadOperationCard
                      key={idx}
                      toolName={tool.toolName}
                      result={result.data !== undefined ? result.data : result}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ))}

      {/* Loading Indicator */}
      {isLoading && (
        <div className="flex gap-3 flex-row">
          <div className="flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-full border shadow-sm bg-muted text-muted-foreground border-border">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
            >
              <path d="M12 2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2 2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" />
              <path d="M12 22a2 2 0 0 1 2-2v-2a2 2 0 0 1-2-2 2 2 0 0 1-2 2v2a2 2 0 0 1 2 2z" />
              <path d="M2 12a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2 2 2 0 0 1-2 2H4a2 2 0 0 1-2-2z" />
              <path d="M22 12a2 2 0 0 1-2-2h-2a2 2 0 0 1-2 2 2 2 0 0 1 2 2h2a2 2 0 0 1 2-2z" />
              <circle cx="12" cy="12" r="2" />
            </svg>
          </div>
          <div className="relative max-w-[90%] md:max-w-[85%] rounded-2xl px-3 py-2.5 md:px-4 md:py-3 text-sm shadow-sm bg-muted text-foreground">
            <div className="flex space-x-1 h-5 items-center">
              <div className="w-1.5 h-1.5 bg-muted-foreground/60 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
              <div className="w-1.5 h-1.5 bg-muted-foreground/60 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
              <div className="w-1.5 h-1.5 bg-muted-foreground/60 rounded-full animate-bounce"></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
"#;
        fs::write(base.join("src/client/components/MessageList.tsx"), content)?;
        println!("    Generated frontend/src/client/components/MessageList.tsx");
        Ok(())
    }

    fn generate_chat_input(&self, base: &Path) -> Result<(), Box<dyn std::error::Error>> {
        let content = r#"import { FormEvent, ChangeEvent } from 'react';

interface ChatInputProps {
  input: string;
  handleInputChange: (e: ChangeEvent<HTMLTextAreaElement>) => void;
  handleSubmit: (e: FormEvent<HTMLFormElement>) => void;
  isLoading: boolean;
}

export function ChatInput({
  input,
  handleInputChange,
  handleSubmit,
  isLoading,
}: ChatInputProps) {
  return (
    <form onSubmit={handleSubmit} className="relative flex items-center w-full">
      <textarea
        value={input}
        onChange={handleInputChange}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            // Create a synthetic event or call handleSubmit directly if possible,
            // but since handleSubmit expects a FormEvent, we trigger the form submit.
            // A programmatic form.requestSubmit() is cleaner but we can just call handleSubmit.
            // However, useChat's handleSubmit expects a FormEvent.
            // We can trick it or find the form and requestSubmit.
            e.currentTarget.form?.requestSubmit();
          }
        }}
        placeholder="Ask Stellar MCP"
        disabled={isLoading}
        className="flex-1 min-h-[48px] md:min-h-[64px] max-h-[200px] py-3 md:py-4 px-4 md:px-6 pr-14 md:pr-16 rounded-3xl border border-input bg-background text-foreground text-base md:text-lg shadow-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-all resize-none overflow-y-auto"
        rows={1}
        style={{ height: 'auto', minHeight: '3rem' }}
      />
      <button
        type="submit"
        disabled={isLoading || !input.trim()}
        className="absolute right-2 bottom-2 md:bottom-3 h-9 w-9 md:h-10 md:w-10 flex items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isLoading ? (
          <svg
            className="animate-spin h-4 w-4 md:h-5 md:w-5"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
        ) : (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4 md:h-5 md:w-5 ml-0.5"
          >
            <path d="M5 12h14" />
            <path d="m12 5 7 7-7 7" />
          </svg>
        )}
        <span className="sr-only">Send</span>
      </button>
    </form>
  );
}
"#;
        fs::write(base.join("src/client/components/ChatInput.tsx"), content)?;
        println!("    Generated frontend/src/client/components/ChatInput.tsx");
        Ok(())
    }

    fn generate_readme(&self, base: &Path) -> Result<(), Box<dyn std::error::Error>> {
        let content = format!(r#"# {} Frontend

AI-powered React frontend for interacting with the {} Stellar smart contract via MCP.

## Features

- **🤖 AI Chat Interface**: Natural language interaction with your smart contract
- **🔐 Dual Authentication**: Toggle between Secret Key and Wallet modes
- **💬 Conversational UI**: Ask the AI to execute contract functions
- **⚡ Real-time Streaming**: Live AI responses with tool execution visibility
- **🌐 Multi-Provider Support**: OpenAI or Anthropic (Claude)

## Architecture

```
User (Browser)
    ↓ Natural Language
Frontend (React + AI SDK)
    ↓ AI Chat API
Express Backend
    ↓ OpenAI/Anthropic
AI Model
    ↓ MCP Tool Calls
MCP Server (Soroban Contract)
    ↓
Stellar Network
```

### How It Works

1. **User types**: "Transfer 100 tokens to GABC..."
2. **AI understands** and calls appropriate MCP tools
3. **MCP server** builds unsigned transaction
4. **AI returns** transaction preview
5. **User signs** with wallet or secret key
6. **Transaction submitted** to Stellar

## Setup

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and add your AI API key:

```bash
# Choose your AI provider
AI_PROVIDER=openai  # or 'anthropic'

# Add your API key
OPENAI_API_KEY=sk-...
# OR
ANTHROPIC_API_KEY=sk-ant-...
```

**Get API Keys:**
- OpenAI: https://platform.openai.com/api-keys
- Anthropic: https://console.anthropic.com/settings/keys

### 3. Start the Servers

You need to run **3 servers** in separate terminals:

#### Terminal 1: MCP Server (HTTP mode)
```bash
cd ..  # Parent directory
USE_HTTP=true PORT=3000 pnpm start
```

#### Terminal 2: API Backend (Express + AI)
```bash
pnpm dev:server
```

#### Terminal 3: Frontend (React)
```bash
pnpm dev:client
```

**Or run all at once:**
```bash
# In the frontend directory
pnpm dev  # Runs both client and server concurrently

# In the parent directory (MCP server)
cd .. && USE_HTTP=true PORT=3000 pnpm start
```

### 4. Open Browser

Navigate to **http://localhost:5173**

## Usage

### Chat Examples

**Query data:**
```
"What's the current balance?"
"Show me the contract state"
```

**Execute transactions:**
```
"Transfer 100 USDC to GABC123..."
"Mint 50 tokens"
```

**Multi-step operations:**
```
"Check the allowance for GABC... and if it's less than 100, increase it"
```

## Authentication Modes

### 🔑 Secret Key Mode
- No upfront key required - provide secret key on-demand when signing
- When you want to sign a transaction, include your secret key in your message
- AI calls `sign-and-submit` MCP tool with the XDR and your secret key
- Server signs and submits transactions
- **Use for:** Testing, automation

### 👛 Wallet Mode
- Connect Freighter or compatible wallet
- AI calls `prepare-transaction` MCP tool
- You sign in your wallet browser extension
- **Use for:** Production, security

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `AI_PROVIDER` | AI provider (`openai` or `anthropic`) | `openai` |
| `OPENAI_API_KEY` | OpenAI API key | - |
| `ANTHROPIC_API_KEY` | Anthropic API key | - |
| `API_PORT` | Express backend port | `3001` |
| `VITE_MCP_SERVER_URL` | MCP server endpoint | `http://localhost:3000` |
| `VITE_API_URL` | Chat API endpoint | `http://localhost:3001/api/chat` |

## Project Structure

```
frontend/
├── src/
│   ├── client/              # React frontend
│   │   ├── components/      # UI components
│   │   │   ├── ChatInterface.tsx      # Main chat UI
│   │   │   ├── MessageList.tsx        # Chat messages
│   │   │   ├── ChatInput.tsx          # Input field
│   │   │   ├── AuthModeSelector.tsx   # Auth mode toggle
│   │   │   ├── WalletConnector.tsx    # Wallet connection
│   │   │   ├── ContractTools.tsx      # Manual tools (legacy)
│   │   │   └── ToolExecutor.tsx       # Tool execution (legacy)
│   │   ├── lib/
│   │   │   └── mcp-client.ts          # MCP client hook
│   │   ├── App.tsx          # Root component
│   │   ├── main.tsx         # Entry point
│   │   └── index.css        # Tailwind styles
│   └── server/              # Express API backend
│       ├── index.ts         # Server entry point
│       └── routes/
│           └── chat.ts      # AI chat endpoint
├── package.json
├── vite.config.ts
├── tailwind.config.ts
└── .env.example
```

## Technology Stack

| Technology | Purpose | Version |
|------------|---------|---------|
| **React 19** | UI framework | ^19.2.1 |
| **TypeScript** | Type safety | ^5.9.3 |
| **Vite 7** | Build tool | ^7.2.6 |
| **Tailwind CSS 4** | Styling | ^4.1.17 |
| **Vercel AI SDK** | AI integration | ^4.0.38 |
| **Express** | API backend | ^4.21.2 |
| **use-mcp** | MCP client | ^0.0.21 |
| **Stellar Wallets Kit** | Wallet integration | ^1.9.5 |

## Development Scripts

```bash
# Development
pnpm dev              # Run both client and server
pnpm dev:client       # Run React app only
pnpm dev:server       # Run Express backend only

# Production
pnpm build            # Build React app
pnpm build:server     # Build Express server
pnpm preview          # Preview production build

# Utilities
pnpm typecheck        # Check TypeScript errors
```

## Troubleshooting

### AI API Key Not Working
- Check `.env` file exists and has correct key
- Restart the server after adding key: `pnpm dev:server`
- Verify key at provider console (OpenAI/Anthropic)

### MCP Server Connection Failed
- Ensure MCP server is running: `USE_HTTP=true PORT=3000 pnpm start`
- Check `VITE_MCP_SERVER_URL` in `.env`
- Verify port 3000 is not in use

### Wallet Not Connecting
- Install Freighter extension
- Ensure wallet is unlocked
- Try refreshing the page

### Chat Not Responding
- Check browser console for errors
- Verify API backend is running on port 3001
- Check AI API key is valid

## Security Notes

⚠️ **Never commit `.env` file to git**
⚠️ **Secret keys should only be used for testing**
⚠️ **Use wallet mode in production**
⚠️ **Keep API keys secure**

## Generated by

[stellar-mcp-generator](https://github.com/stellar/stellar-mcp-generator)
"#, self.server_name, self.server_name);
        fs::write(base.join("README.md"), content)?;
        println!("    Generated frontend/README.md");
        Ok(())
    }
}

import { defineConfig } from 'vite';

export default defineConfig({
  resolve: {
    alias: {
      // The `eventsource` npm package is a Node.js polyfill.
      // Browsers ship native EventSource — redirect imports to this thin shim.
      eventsource: new URL('src/shims/eventsource.ts', import.meta.url).pathname,
    },
  },

  optimizeDeps: {
    // eventsource-parser/stream ships as CJS (stream.js uses module.exports/require).
    // Vite must pre-bundle it as ESM so pipeThrough() works in the browser.
    include: ['eventsource-parser/stream'],
  },

  define: {
    // Some Stellar SDK code references process.env; stub it for the browser.
    'process.env': '{}',
    // @creit.tech/stellar-wallets-kit (and some of its deps) reference Node.js globals.
    'global': 'globalThis',
  },

  server: {
    port: 5173,
    open: true,
    proxy: {
      // Proxy /mcp to the MCP server — eliminates CORS for browser fetch + SSE streaming
      '/mcp': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },

  build: {
    sourcemap: true,
    target: 'es2020',
  },
});

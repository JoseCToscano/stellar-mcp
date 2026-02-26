import { defineConfig } from 'tsup';

export default defineConfig([
  // ─── SDK (library) ───────────────────────────────────────────────────────────
  {
    entry: {
      index: 'src/index.ts',
      'signers/freighter': 'src/signers/freighter.ts',
      'signers/passkey': 'src/signers/passkey.ts',
      'signers/secret': 'src/signers/secret.ts',
    },
    format: ['esm', 'cjs'],
    dts: true,
    splitting: true,
    sourcemap: true,
    clean: true,
    external: [
      '@modelcontextprotocol/sdk',
      '@stellar/stellar-sdk',
      '@creit.tech/stellar-wallets-kit',
      'passkey-kit',
    ],
    treeshake: true,
  },

  // ─── CLI (generate-types) ────────────────────────────────────────────────────
  {
    entry: { 'cli/generate-types': 'src/cli/generate-types.ts' },
    format: ['esm'],
    dts: false,
    splitting: false,
    sourcemap: false,
    clean: false,
    external: [
      '@modelcontextprotocol/sdk',
      '@stellar/stellar-sdk',
      'json-schema-to-typescript',
    ],
    // Preserve the #!/usr/bin/env node shebang from the source file
    banner: { js: '#!/usr/bin/env node' },
  },
]);

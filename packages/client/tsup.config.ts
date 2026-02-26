import { defineConfig } from 'tsup';

export default defineConfig({
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
});

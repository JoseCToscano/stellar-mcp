import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.mock factories are hoisted — use vi.hoisted() so mockConfig is in scope.
const mockConfig = vi.hoisted(() => ({
  mcpUrl: 'http://localhost:3000/mcp',
  rpcUrl: 'https://soroban-testnet.stellar.org',
  networkPassphrase: 'Test SDF Network ; September 2015',
  signerSecret: undefined as string | undefined,
}));

vi.mock('../../src/config.js', () => ({ config: mockConfig }));

// Chalk: return plain strings so assertions don't need to strip ANSI codes.
vi.mock('chalk', () => {
  const pass = (s: string) => s;
  const proxy = new Proxy(pass, {
    get: () => proxy,
  });
  return { default: proxy };
});

// Ora: no-op spinner
vi.mock('ora', () => ({
  default: vi.fn(() => ({ start: vi.fn().mockReturnThis(), stop: vi.fn(), text: '' })),
}));

// cli-table3: minimal stub
vi.mock('cli-table3', () => ({
  default: vi.fn(() => ({
    push: vi.fn(),
    toString: vi.fn(() => '<table>'),
  })),
}));

import {
  isMainnet,
  explorerUrl,
  mkSpinner,
  printSuccess,
  printWritePreview,
  printError,
} from '../../src/ui.js';
import { EXPLORER_BASE_URL } from '../../src/constants.js';

describe('ui utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConfig.networkPassphrase = 'Test SDF Network ; September 2015';
  });

  // ─── isMainnet ─────────────────────────────────────────────────────────────

  describe('isMainnet()', () => {
    it('returns false for testnet passphrase', () => {
      mockConfig.networkPassphrase = 'Test SDF Network ; September 2015';
      expect(isMainnet()).toBe(false);
    });

    it('returns true for mainnet passphrase', () => {
      mockConfig.networkPassphrase = 'Public Global Stellar Network ; September 2015';
      expect(isMainnet()).toBe(true);
    });
  });

  // ─── explorerUrl ───────────────────────────────────────────────────────────

  describe('explorerUrl()', () => {
    it('builds testnet explorer URL', () => {
      mockConfig.networkPassphrase = 'Test SDF Network ; September 2015';
      expect(explorerUrl('abc123')).toBe(`${EXPLORER_BASE_URL}/testnet/tx/abc123`);
    });

    it('builds mainnet explorer URL', () => {
      mockConfig.networkPassphrase = 'Public Global Stellar Network ; September 2015';
      expect(explorerUrl('def456')).toBe(`${EXPLORER_BASE_URL}/public/tx/def456`);
    });
  });

  // ─── mkSpinner ─────────────────────────────────────────────────────────────

  describe('mkSpinner()', () => {
    it('returns an object with a stop method', () => {
      const spin = mkSpinner('Loading…');
      expect(typeof spin.stop).toBe('function');
    });
  });

  // ─── printSuccess ──────────────────────────────────────────────────────────

  describe('printSuccess()', () => {
    it('logs the transaction hash', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      printSuccess('myhash123');
      expect(spy.mock.calls.flat().join('\n')).toContain('myhash123');
      spy.mockRestore();
    });

    it('includes a stellar.expert link', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      printSuccess('myhash123');
      expect(spy.mock.calls.flat().join('\n')).toContain('stellar.expert');
      spy.mockRestore();
    });
  });

  // ─── printWritePreview ─────────────────────────────────────────────────────

  describe('printWritePreview()', () => {
    it('logs the XDR string', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      printWritePreview('AAAAAXDR==');
      expect(spy.mock.calls.flat().join('\n')).toContain('AAAAAXDR==');
      spy.mockRestore();
    });

    it('mentions SIGNER_SECRET', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      printWritePreview('AAAAAXDR==');
      expect(spy.mock.calls.flat().join('\n')).toContain('SIGNER_SECRET');
      spy.mockRestore();
    });
  });

  // ─── printError ────────────────────────────────────────────────────────────

  describe('printError()', () => {
    it('exits with code 1', () => {
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
      vi.spyOn(console, 'error').mockImplementation(() => {});

      printError('something went wrong');

      expect(exitSpy).toHaveBeenCalledWith(1);
      exitSpy.mockRestore();
    });

    it('writes the message to stderr', () => {
      vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      printError('oops');

      expect(errSpy.mock.calls.flat().join('\n')).toContain('oops');
      errSpy.mockRestore();
    });
  });
});

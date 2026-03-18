import { describe, it, expect } from 'vitest';
import {
  DEFAULT_RPC_URL,
  DEFAULT_NETWORK_PASSPHRASE,
  MAINNET_PASSPHRASE_FRAGMENT,
  TESTNET_PASSPHRASE_FRAGMENT,
  EXPLORER_BASE_URL,
  INTERNAL_TOOLS,
  SPINNER_CALLING,
  EXIT_OK,
  EXIT_ERROR,
} from '../../src/constants.js';

describe('constants', () => {
  it('DEFAULT_RPC_URL points to testnet', () => {
    expect(DEFAULT_RPC_URL).toBe('https://soroban-testnet.stellar.org');
  });

  it('DEFAULT_NETWORK_PASSPHRASE is testnet passphrase', () => {
    expect(DEFAULT_NETWORK_PASSPHRASE).toContain('Test SDF');
  });

  it('MAINNET_PASSPHRASE_FRAGMENT distinguishes mainnet', () => {
    const mainnet = 'Public Global Stellar Network ; September 2015';
    expect(mainnet).toContain(MAINNET_PASSPHRASE_FRAGMENT);
    expect(DEFAULT_NETWORK_PASSPHRASE).not.toContain(MAINNET_PASSPHRASE_FRAGMENT);
  });

  it('TESTNET_PASSPHRASE_FRAGMENT distinguishes testnet', () => {
    expect(DEFAULT_NETWORK_PASSPHRASE).toContain(TESTNET_PASSPHRASE_FRAGMENT);
  });

  it('EXPLORER_BASE_URL is stellar.expert', () => {
    expect(EXPLORER_BASE_URL).toBe('https://stellar.expert/explorer');
  });

  it('INTERNAL_TOOLS contains the three plumbing tools', () => {
    expect(INTERNAL_TOOLS.has('sign-and-submit')).toBe(true);
    expect(INTERNAL_TOOLS.has('prepare-transaction')).toBe(true);
    expect(INTERNAL_TOOLS.has('prepare-sign-and-submit')).toBe(true);
  });

  it('INTERNAL_TOOLS does not include user-facing tools', () => {
    expect(INTERNAL_TOOLS.has('get-admin')).toBe(false);
    expect(INTERNAL_TOOLS.has('deploy-token')).toBe(false);
  });

  it('SPINNER_CALLING interpolates the tool name', () => {
    expect(SPINNER_CALLING('deploy-token')).toBe('Calling deploy-token…');
  });

  it('exit codes are correct', () => {
    expect(EXIT_OK).toBe(0);
    expect(EXIT_ERROR).toBe(1);
  });
});

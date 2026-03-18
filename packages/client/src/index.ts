// ─── Core ─────────────────────────────────────────────────────────────────────
export { MCPClient } from './client.js';

// ─── Types ────────────────────────────────────────────────────────────────────
export type {
  MCPClientOptions,
  ToolDef,
  ToolMap,
  CallResult,
  SimulateResult,
  SubmitResult,
  ToolInfo,
  Signer,
  SignerContext,
  SignAndSubmitOptions,
  FreighterSignerOptions,
  FreighterConnection,
  PasskeyKitSignerOptions,
} from './types.js';

// ─── Constants ────────────────────────────────────────────────────────────────
export { DEFAULT_TIMEOUT_MS, POLL_INTERVAL_MS, MAX_POLL_ATTEMPTS } from './types.js';

// ─── Logger ───────────────────────────────────────────────────────────────────
export { logger, LOG_LEVELS } from './logger.js';
export type { LogLevel } from './logger.js';

// ─── Errors ───────────────────────────────────────────────────────────────────
export { MCPClientError, MCPConnectionError, MCPToolError, TransactionError } from './errors.js';

// ─── Schema utilities ─────────────────────────────────────────────────────────
export {
  isReadOperation,
  extractArgs,
  buildToolArgs,
  parseArgValue,
  argKey,
} from './schema.js';
export type { ArgDef } from './schema.js';

// ─── Signers ──────────────────────────────────────────────────────────────────
// Also available via separate entry points for tree-shaking:
//   import { secretKeySigner } from '@stellar-mcp/client/signers/secret'
//   import { freighterSigner } from '@stellar-mcp/client/signers/freighter'
//   import { passkeyKitSigner } from '@stellar-mcp/client/signers/passkey'
export { secretKeySigner } from './signers/secret.js';
export { passkeyKitSigner } from './signers/passkey.js';
export { freighterSigner, connectFreighter } from './signers/freighter.js';

// ─── Named Constants ──────────────────────────────────────────────────────────
// All timing and retry values are named — no magic numbers anywhere in the SDK.

/** Default timeout for MCP requests in milliseconds */
export const DEFAULT_TIMEOUT_MS = 30_000;

/** Interval between transaction confirmation polls in milliseconds */
export const POLL_INTERVAL_MS = 500;

/** Maximum number of polling attempts before giving up */
export const MAX_POLL_ATTEMPTS = 60;

/** MCP tool name for signing and submitting transactions */
export const TOOL_SIGN_AND_SUBMIT = 'sign-and-submit';

/** MCP tool name for preparing transactions for wallet signing */
export const TOOL_PREPARE_TRANSACTION = 'prepare-transaction';

// ─── Client Options ───────────────────────────────────────────────────────────

/** Configuration for creating an MCPClient instance */
export interface MCPClientOptions {
  /** Full MCP server URL — user provides exactly as-is (e.g. http://localhost:3000/mcp) */
  url: string;

  /** Stellar network passphrase (required — no magic defaults) */
  networkPassphrase: string;

  /** Soroban RPC URL (required — no magic defaults) */
  rpcUrl: string;

  /** Request timeout in milliseconds (default: DEFAULT_TIMEOUT_MS) */
  timeout?: number;
}

// ─── Tool Discovery ───────────────────────────────────────────────────────────

/** Information about an MCP tool discovered via listTools() */
export interface ToolInfo {
  /** Tool name (kebab-case, e.g. 'deploy-token', 'sign-and-submit') */
  name: string;

  /** Human-readable description of what the tool does */
  description: string;

  /** JSON Schema describing the tool's input parameters */
  inputSchema: Record<string, unknown>;
}

// ─── Call Results ─────────────────────────────────────────────────────────────

/** Result from calling an MCP tool via client.call() */
export interface CallResult {
  /** Full parsed JSON from the MCP response */
  data: unknown;

  /** Transaction XDR — present for write operations, absent for read-only tools */
  xdr?: string;

  /** Simulation metadata — present when the server includes it */
  simulationResult?: unknown;
}

/** Result from signing and submitting a transaction */
export interface SubmitResult {
  /** Transaction hash on the Stellar network */
  hash: string;

  /** Transaction status (e.g. 'SUCCESS', 'FAILED') */
  status: string;

  /** Parsed transaction result — present on success */
  result?: unknown;
}

// ─── Signer Interface ─────────────────────────────────────────────────────────

/**
 * Internal context passed to signers by MCPClient.
 * Users never construct this — it's plumbed automatically from MCPClientOptions.
 */
export interface SignerContext {
  /** Soroban RPC URL from client config */
  rpcUrl: string;

  /** Stellar network passphrase from client config */
  networkPassphrase: string;

  /** Call an MCP tool — allows signers to invoke server-side tools */
  mcpCall: (tool: string, args: Record<string, unknown>) => Promise<unknown>;
}

/**
 * Pluggable signer adapter.
 * Each signer factory (secretKeySigner, freighterSigner, etc.) returns this interface.
 */
export interface Signer {
  /** Execute signing and submission for the given XDR */
  execute: (xdr: string, context: SignerContext) => Promise<SubmitResult>;
}

// ─── Signer Options ───────────────────────────────────────────────────────────

/** Options for the Freighter browser wallet signer */
export interface FreighterSignerOptions {
  /** Allowed Stellar networks for wallet connection */
  allowedNetworks?: string[];
}

/** Options for the PasskeyKit smart wallet signer */
export interface PasskeyKitSignerOptions {
  /** Smart wallet contract ID on the Stellar network */
  walletContractId: string;

  /** Secret key used as fee payer for the transaction envelope */
  feePayerSecret: string;
}

// ─── Sign & Submit Options ────────────────────────────────────────────────────

/** Options passed to client.signAndSubmit() */
export interface SignAndSubmitOptions {
  /** The signer adapter to use for this transaction */
  signer: Signer;
}

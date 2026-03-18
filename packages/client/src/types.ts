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

  /** JSON Schema describing the tool's structured output — present when the server
   *  registers the tool with an `outputSchema` (MCP SDK ≥ 1.24.3). */
  outputSchema?: Record<string, unknown>;
}

// ─── Typed Tool Map ───────────────────────────────────────────────────────────

/**
 * Describes a single MCP tool — what goes in (`args`) and what comes out (`result`).
 * Use this as the value type when building a `ToolMap`.
 */
export interface ToolDef<TArgs = unknown, TResult = unknown> {
  args: TArgs;
  result: TResult;
}

/**
 * Map of tool names → their `ToolDef`.
 * Pass this as the generic to `MCPClient` to get typed `call()` calls.
 *
 * Usually you generate this file once with:
 * ```bash
 * npx mcp-generate-types --url http://localhost:3001/mcp --out ./mcp-types.ts
 * ```
 * Then import `createMCPClient` from the generated file — no generics needed in your code.
 */
export type ToolMap = Record<string, ToolDef>;

// ─── Call Results ─────────────────────────────────────────────────────────────

/**
 * Result from calling an MCP tool via client.call().
 * `TData` is inferred from your `ToolMap` when you use a typed client.
 */
export interface CallResult<TData = unknown> {
  /** Full parsed JSON from the MCP response */
  data: TData;

  /** Transaction XDR — present for write operations, absent for read-only tools */
  xdr?: string;

  /** Simulation metadata — present when the server includes it */
  simulationResult?: unknown;
}

/**
 * Result from simulating a transaction via client.simulate().
 * Contains the XDR ready to sign and the estimated fee — without committing.
 *
 * Lifecycle:
 * ```ts
 * const preview = await client.simulate('deploy-token', args);
 * console.log(`Estimated fee: ${preview.fee} stroops`);
 * const { hash } = await client.signAndSubmit(preview.xdr!, { signer });
 * const result = await client.waitForConfirmation(hash);
 * ```
 */
export interface SimulateResult<TData = unknown> {
  /** Transaction XDR — ready to sign if you choose to proceed */
  xdr?: string;

  /** Estimated transaction fee in stroops (extracted from the assembled XDR) */
  fee?: string;

  /** Decoded simulation result — the return value of the contract function */
  simulationResult?: TData;
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

/**
 * Result returned by connectFreighter().
 * Contains both the wallet address (for UI) and a pre-connected signer (for transactions).
 */
export interface FreighterConnection {
  /** The connected wallet's Stellar public key (G...) */
  address: string;

  /**
   * A ready-to-use signer adapter.
   * Pass directly to client.signAndSubmit() — will not re-prompt Freighter for address.
   */
  signer: Signer;
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

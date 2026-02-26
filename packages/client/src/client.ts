import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { createTransport, createSSETransport } from './transport.js';
import { MCPConnectionError, MCPToolError } from './errors.js';
import {
  DEFAULT_TIMEOUT_MS,
  type MCPClientOptions,
  type CallResult,
  type SubmitResult,
  type ToolInfo,
  type ToolMap,
  type SignerContext,
  type SignAndSubmitOptions,
} from './types.js';
import { pollTransaction } from './transaction.js';
import { logger } from './logger.js';

/** SDK client name sent during MCP initialization handshake */
const CLIENT_NAME = '@stellar-mcp/client';

/** SDK version sent during MCP initialization handshake */
const CLIENT_VERSION = '0.1.0';

/**
 * Programmatic client for Stellar MCP servers.
 *
 * ### Untyped usage (quick start)
 * Works out of the box — tool names and args are loosely typed.
 * ```ts
 * const client = new MCPClient({ url, networkPassphrase, rpcUrl });
 * const { data } = await client.call('get-admin'); // data: unknown
 * ```
 *
 * ### Typed usage (recommended)
 * Run `npx mcp-generate-types --url <url> --out ./mcp-types.ts` once to generate
 * a typed file, then import `createMCPClient` from it — no generics needed in your code:
 * ```ts
 * import { createMCPClient } from './mcp-types';
 * const client = createMCPClient({ url, networkPassphrase, rpcUrl });
 * const { data } = await client.call('get-admin'); // data: unknown (typed by generated file)
 * await client.call('deploy-token', { deployer, config }); // args fully checked
 * ```
 *
 * ### Manual typed usage
 * If you prefer to define types yourself, pass `ToolMap` as a generic:
 * ```ts
 * interface MyTools extends ToolMap {
 *   'get-admin': { args: Record<string, never>; result: string };
 *   'deploy-token': { args: DeployTokenArgs; result: unknown };
 * }
 * const client = new MCPClient<MyTools>({ url, networkPassphrase, rpcUrl });
 * ```
 */
export class MCPClient<TTools extends ToolMap = ToolMap> {
  private readonly options: Required<
    Pick<MCPClientOptions, 'url' | 'networkPassphrase' | 'rpcUrl'>
  > &
    Pick<MCPClientOptions, 'timeout'>;
  private mcpClient: Client | null = null;
  private connectionPromise: Promise<void> | null = null;

  constructor(options: MCPClientOptions) {
    validateOptions(options);

    this.options = {
      url: options.url,
      networkPassphrase: options.networkPassphrase,
      rpcUrl: options.rpcUrl,
      timeout: options.timeout ?? DEFAULT_TIMEOUT_MS,
    };
  }

  /**
   * Discover all tools available on the MCP server.
   * Returns tool metadata including name, description, and input schema.
   */
  async listTools(): Promise<ToolInfo[]> {
    logger.debug('Listing tools');
    const client = await this.ensureConnected();
    const response = await client.listTools(undefined, { timeout: this.options.timeout });
    logger.info('Discovered tools', { count: response.tools.length });

    return response.tools.map((tool) => ({
      name: tool.name,
      description: tool.description ?? '',
      inputSchema: tool.inputSchema as Record<string, unknown>,
    }));
  }

  /**
   * Call an MCP tool by name with the given arguments.
   *
   * When `MCPClient` is constructed with a `ToolMap` type parameter (or via
   * `createMCPClient` from a generated file), `toolName` is constrained to
   * the known tool names and `args` is typed to that tool's input schema.
   * The returned `data` is typed to that tool's result type.
   *
   * For write operations the result also includes `xdr`.
   * For read-only tools only `data` is populated.
   */
  async call<K extends keyof TTools & string>(
    toolName: K,
    args: TTools[K]['args'] = {} as TTools[K]['args'],
  ): Promise<CallResult<TTools[K]['result']>> {
    logger.debug('Calling tool', { toolName, args });
    const client = await this.ensureConnected();

    const response = await client.callTool(
      { name: toolName, arguments: args as Record<string, unknown> },
      undefined,
      { timeout: this.options.timeout },
    );

    // Check for MCP-level error
    if ('isError' in response && response.isError) {
      const errorText = extractTextContent(response.content);
      throw new MCPToolError(toolName, errorText);
    }

    // Extract and parse the text content
    const rawText = extractTextContent('content' in response ? response.content : []);
    const data = parseJsonSafe(rawText);

    // Check for application-level error in parsed data
    if (isErrorResponse(data)) {
      throw new MCPToolError(
        toolName,
        ((data as Record<string, unknown>).message as string) ?? rawText,
      );
    }

    const result: CallResult<TTools[K]['result']> = {
      data: data as TTools[K]['result'],
      xdr: extractStringField(data, 'xdr'),
      simulationResult: extractField(data, 'simulationResult'),
    };

    logger.debug('Tool call result', { toolName, hasXdr: !!result.xdr });
    return result;
  }

  /**
   * Sign and submit a transaction using the provided signer adapter.
   *
   * The signer receives a `SignerContext` with `rpcUrl`, `networkPassphrase`,
   * and a bound `mcpCall` function for invoking MCP server tools.
   */
  async signAndSubmit(xdr: string, options: SignAndSubmitOptions): Promise<SubmitResult> {
    logger.info('Signing and submitting transaction');
    const context = this.buildSignerContext();
    const result = await options.signer.execute(xdr, context);
    logger.info('Transaction submitted', { hash: result.hash, status: result.status });
    return result;
  }

  /**
   * Wait for a transaction to be confirmed on the Stellar network.
   * Polls the Soroban RPC endpoint until the transaction succeeds or fails.
   */
  async waitForConfirmation(hash: string): Promise<SubmitResult> {
    logger.debug('Waiting for transaction confirmation', { hash });
    const result = await pollTransaction(hash, this.options.rpcUrl);
    logger.info('Transaction confirmed', { hash: result.hash, status: result.status });
    return result;
  }

  /**
   * Close the MCP transport connection.
   * Safe to call multiple times.
   */
  close(): void {
    if (this.mcpClient) {
      logger.debug('Closing MCP connection');
      this.mcpClient.close().catch(() => {
        // Swallow close errors — connection may already be gone
      });
      this.mcpClient = null;
      this.connectionPromise = null;
    }
  }

  // ─── Internal ───────────────────────────────────────────────────────────────

  /**
   * Lazy connection — connects on first call, reuses connection thereafter.
   * Thread-safe: concurrent calls share the same connection promise.
   */
  private async ensureConnected(): Promise<Client> {
    if (this.mcpClient) {
      return this.mcpClient;
    }

    if (!this.connectionPromise) {
      this.connectionPromise = this.connect();
    }

    await this.connectionPromise;

    if (!this.mcpClient) {
      throw new MCPConnectionError('Connection failed: client not initialized after connect');
    }

    return this.mcpClient;
  }

  /**
   * Establish connection. Tries StreamableHTTP first, falls back to SSE.
   * Both protocols use the same URL — the transport negotiates the protocol.
   */
  private async connect(): Promise<void> {
    const { url } = this.options;
    const client = new Client({ name: CLIENT_NAME, version: CLIENT_VERSION }, {});

    try {
      const transport = await createTransport(url);
      await client.connect(transport);
    } catch (httpError) {
      // If the URL was invalid, MCPConnectionError was already thrown with a clear message
      if (httpError instanceof MCPConnectionError) {
        this.connectionPromise = null;
        throw httpError;
      }

      // StreamableHTTP connection failed — try legacy SSE transport
      logger.warn('StreamableHTTP failed, retrying with SSE', { url });
      try {
        const transport = createSSETransport(url);
        await client.connect(transport);
      } catch (sseError) {
        this.connectionPromise = null;
        logger.error('Both transports failed', { url, error: sseError });
        throw new MCPConnectionError(`Failed to connect to MCP server at ${url}`, sseError);
      }
    }

    this.mcpClient = client;
    logger.info('Connected to MCP server', { url });
  }

  /**
   * Build a SignerContext from client options.
   * The bound mcpCall allows signers to invoke MCP tools.
   */
  private buildSignerContext(): SignerContext {
    return {
      rpcUrl: this.options.rpcUrl,
      networkPassphrase: this.options.networkPassphrase,
      mcpCall: async (tool: string, args: Record<string, unknown>) => {
        const result = await this.call(tool, args);
        return result.data;
      },
    };
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function validateOptions(options: MCPClientOptions): void {
  if (!options.url) {
    throw new MCPConnectionError('MCPClientOptions.url is required');
  }
  if (!options.networkPassphrase) {
    throw new MCPConnectionError('MCPClientOptions.networkPassphrase is required');
  }
  if (!options.rpcUrl) {
    throw new MCPConnectionError('MCPClientOptions.rpcUrl is required');
  }
}

/**
 * Extract text from MCP response content array.
 * MCP tools return { content: [{ type: 'text', text: '...' }] }
 */
function extractTextContent(content: unknown): string {
  if (!Array.isArray(content) || content.length === 0) return '';
  const first = content[0];
  if (typeof first === 'object' && first !== null && 'text' in first) {
    return String((first as { text: unknown }).text);
  }
  return '';
}

/** Parse JSON safely, returning the raw string if parsing fails */
function parseJsonSafe(text: string): unknown {
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/** Check if a parsed response looks like an error */
function isErrorResponse(data: unknown): boolean {
  if (typeof data !== 'object' || data === null) return false;
  return 'error' in data && !('xdr' in data);
}

/** Safely extract a string field from parsed data */
function extractStringField(data: unknown, field: string): string | undefined {
  if (typeof data !== 'object' || data === null) return undefined;
  const value = (data as Record<string, unknown>)[field];
  if (typeof value === 'string') return value;
  return undefined;
}

/** Safely extract any field from parsed data (returns undefined if missing) */
function extractField(data: unknown, field: string): unknown {
  if (typeof data !== 'object' || data === null) return undefined;
  return (data as Record<string, unknown>)[field];
}

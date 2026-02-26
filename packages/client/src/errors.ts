/**
 * Base error for all @stellar-mcp/client errors.
 * Carries an optional `cause` for error chaining.
 */
export class MCPClientError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'MCPClientError';
  }
}

/**
 * Thrown when the SDK cannot connect to the MCP server.
 * Covers transport failures, timeouts, and handshake errors.
 */
export class MCPConnectionError extends MCPClientError {
  constructor(message: string, cause?: unknown) {
    super(message, cause);
    this.name = 'MCPConnectionError';
  }
}

/**
 * Thrown when an MCP tool returns an error response (isError: true).
 * Carries the tool name for debugging.
 */
export class MCPToolError extends MCPClientError {
  constructor(
    public readonly toolName: string,
    message: string,
    cause?: unknown,
  ) {
    super(`Tool '${toolName}' failed: ${message}`, cause);
    this.name = 'MCPToolError';
  }
}

/**
 * Thrown when transaction submission or confirmation fails.
 * Carries the transaction hash when available.
 */
export class TransactionError extends MCPClientError {
  constructor(
    message: string,
    public readonly hash?: string,
    cause?: unknown,
  ) {
    super(message, cause);
    this.name = 'TransactionError';
  }
}

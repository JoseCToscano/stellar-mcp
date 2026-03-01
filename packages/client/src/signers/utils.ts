import type { SubmitResult } from '../types.js';
import { MCPToolError } from '../errors.js';
import { TOOL_SIGN_AND_SUBMIT } from '../types.js';

/**
 * Parse the sign-and-submit tool response into a SubmitResult.
 *
 * Handles two server response shapes:
 * - Nested: `{ success: true, result: { hash, status, parsedResult? } }`
 * - Flat:   `{ hash, status }`
 */
export function parseSubmitResponse(data: unknown): SubmitResult {
  if (typeof data !== 'object' || data === null) {
    throw new MCPToolError(TOOL_SIGN_AND_SUBMIT, 'Unexpected response format');
  }

  const response = data as Record<string, unknown>;

  // If the server returned { success: false, result: <errMsg> }, propagate the error
  if (response.success === false) {
    const errMsg = typeof response.result === 'string'
      ? response.result
      : JSON.stringify(response.result ?? response);
    throw new MCPToolError(TOOL_SIGN_AND_SUBMIT, errMsg);
  }

  const result = response.result as Record<string, unknown> | undefined;

  return {
    hash: String(result?.hash ?? response.hash ?? ''),
    status: String(result?.status ?? response.status ?? 'UNKNOWN'),
    result: result?.parsedResult ?? result,
  };
}

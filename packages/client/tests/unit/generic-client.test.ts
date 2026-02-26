/**
 * Type-level tests for MCPClient<TTools> generics.
 *
 * These tests verify that the TypeScript type system correctly constrains
 * tool names, arg shapes, and return types when a ToolMap is provided.
 * The compile step is the real assertion — runtime is just a sanity check.
 */
import { describe, it, expect, expectTypeOf } from 'vitest';
import { MCPClient } from '../../src/client.js';
import type { ToolMap, CallResult } from '../../src/types.js';

// ─── Shared fixture ───────────────────────────────────────────────────────────

interface TestTools extends ToolMap {
  'get-name': { args: Record<string, never>; result: string };
  'get-count': { args: Record<string, never>; result: number };
  'create-item': { args: { name: string; value: number }; result: { id: string } };
}

// Constructor validates url/networkPassphrase/rpcUrl are non-empty but doesn't
// open a connection — safe to create with placeholder values for type tests.
const typedClient = new MCPClient<TestTools>({
  url: 'http://example.com/mcp',
  networkPassphrase: 'test-network',
  rpcUrl: 'http://example.com/rpc',
});

const untypedClient = new MCPClient({
  url: 'http://example.com/mcp',
  networkPassphrase: 'test-network',
  rpcUrl: 'http://example.com/rpc',
});

// ─── Tool name constraint ─────────────────────────────────────────────────────

describe('MCPClient<TTools> — tool name type constraint', () => {
  it('call() first parameter is constrained to known tool names', () => {
    expectTypeOf(typedClient.call)
      .parameter(0)
      .toEqualTypeOf<'get-name' | 'get-count' | 'create-item'>();
  });

  it('call() first parameter is string on untyped client', () => {
    expectTypeOf(untypedClient.call).parameter(0).toEqualTypeOf<string>();
  });
});

// ─── Return type narrowing ────────────────────────────────────────────────────

describe('MCPClient<TTools> — return type narrowing', () => {
  it('call() data is typed to the tool result on a typed client', () => {
    type GetNameResult = Awaited<ReturnType<typeof typedClient.call<'get-name'>>>;
    expectTypeOf<GetNameResult>().toMatchTypeOf<CallResult<string>>();
  });

  it('call() data is unknown on an untyped client', () => {
    type UntypedResult = Awaited<ReturnType<typeof untypedClient.call>>;
    expectTypeOf<UntypedResult>().toMatchTypeOf<CallResult<unknown>>();
  });

  it('CallResult is generic over its data field', () => {
    expectTypeOf<CallResult<string>>().toHaveProperty('data').toEqualTypeOf<string>();
    expectTypeOf<CallResult<number>>().toHaveProperty('data').toEqualTypeOf<number>();
    expectTypeOf<CallResult>().toHaveProperty('data').toEqualTypeOf<unknown>();
  });
});

// ─── ToolDef / ToolMap exports ────────────────────────────────────────────────

describe('ToolDef and ToolMap type exports', () => {
  it('ToolMap can be extended to define typed tools', () => {
    // If this compiles, the type is correct — it is the test.
    const _tools: ToolMap = {
      'my-tool': { args: { foo: 'bar' }, result: 'something' },
    };
    expect(true).toBe(true); // runtime sanity check
  });

  it('MCPClient constructor accepts known options', () => {
    expect(
      () =>
        new MCPClient<TestTools>({
          url: 'http://example.com/mcp',
          networkPassphrase: 'net',
          rpcUrl: 'http://example.com',
        }),
    ).not.toThrow();
  });
});

// The @modelcontextprotocol/sdk's SSE transport imports the `eventsource`
// npm package (a Node.js polyfill). Browsers already have native EventSource.
// This shim re-exports the native global so the import resolves correctly.

export const EventSource = globalThis.EventSource;
export default globalThis.EventSource;

// Type aliases to satisfy the MCP SDK's imports from this package
export type ErrorEvent = Event;
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export type EventSourceMessageEvent = MessageEvent;
export type EventSourceInit = { withCredentials?: boolean };

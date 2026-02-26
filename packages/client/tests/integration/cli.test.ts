/**
 * Integration tests for the generate-types CLI.
 *
 * Requires a running MCP server and RUN_INTEGRATION=1.
 *
 * Usage:
 *   RUN_INTEGRATION=1 npm run test:integration
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';

const RUN_INTEGRATION = process.env.RUN_INTEGRATION === '1';
const MCP_URL = process.env.MCP_URL ?? 'http://localhost:3001/mcp';

const CLI_PATH = resolve(import.meta.dirname, '../../dist/cli/generate-types.js');
const OUT_FILE = resolve('/tmp/test-mcp-types-output.ts');

describe.skipIf(!RUN_INTEGRATION)('generate-types CLI', () => {
  beforeAll(() => {
    if (existsSync(OUT_FILE)) unlinkSync(OUT_FILE);
    // Run the CLI — this is the core assertion: it must exit 0
    execSync(`node ${CLI_PATH} --url ${MCP_URL} --out ${OUT_FILE}`, { stdio: 'pipe' });
  });

  afterAll(() => {
    if (existsSync(OUT_FILE)) unlinkSync(OUT_FILE);
  });

  it('creates the output file', () => {
    expect(existsSync(OUT_FILE)).toBe(true);
  });

  it('output file imports from @stellar-mcp/client', () => {
    const content = readFileSync(OUT_FILE, 'utf-8');
    expect(content).toContain("from '@stellar-mcp/client'");
  });

  it('output file exports createMCPClient factory', () => {
    const content = readFileSync(OUT_FILE, 'utf-8');
    expect(content).toContain('export function createMCPClient');
    expect(content).toContain('MCPClient<ServerTools>');
  });

  it('output file contains typed args for deploy-token', () => {
    const content = readFileSync(OUT_FILE, 'utf-8');
    expect(content).toContain('export interface DeployTokenArgs');
    expect(content).toContain('deployer: string');
    expect(content).toContain("tag: \"Allowlist\"");
  });

  it('no-arg tools use Record<string, never>', () => {
    const content = readFileSync(OUT_FILE, 'utf-8');
    expect(content).toContain('GetAdminArgs = Record<string, never>');
    expect(content).toContain('GetTokenCountArgs = Record<string, never>');
  });

  it('output file contains a ServerTools ToolMap with all tools', () => {
    const content = readFileSync(OUT_FILE, 'utf-8');
    // ServerTools is a plain interface (no extends ToolMap — avoids index signature widening)
    expect(content).toContain("interface ServerTools {");
    expect(content).toContain("'get-admin'");
    expect(content).toContain("'deploy-token'");
    expect(content).toContain("'sign-and-submit'");
  });

  it('output file contains typed result interfaces (not result: unknown)', () => {
    const content = readFileSync(OUT_FILE, 'utf-8');
    // Tools with outputSchema should have named result types
    expect(content).toContain('export interface GetAdminResult');
    expect(content).toContain('export interface GetDeployedTokensResult');
    // The ToolMap should reference those types
    expect(content).toContain("result: GetAdminResult");
    expect(content).toContain("result: GetDeployedTokensResult");
  });

  it('listTools includes outputSchema for contract tools', () => {
    const content = readFileSync(OUT_FILE, 'utf-8');
    // Result types have xdr + simulationResult fields (from outputSchema)
    expect(content).toContain('simulationResult?:');
  });

  it('output file has DO NOT EDIT header', () => {
    const content = readFileSync(OUT_FILE, 'utf-8');
    expect(content).toContain('DO NOT EDIT');
    expect(content).toContain(MCP_URL);
  });
});

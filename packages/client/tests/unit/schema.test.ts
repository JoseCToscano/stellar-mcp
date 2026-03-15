import { describe, it, expect } from 'vitest';
import {
  isReadOperation,
  extractArgs,
  buildToolArgs,
  parseArgValue,
  argKey,
} from '../../src/schema.js';
import type { ArgDef } from '../../src/schema.js';
import type { ToolInfo } from '../../src/types.js';

// ─── isReadOperation ──────────────────────────────────────────────────────────

describe('isReadOperation', () => {
  it('returns true for get- prefix', () => {
    expect(isReadOperation('get-admin')).toBe(true);
    expect(isReadOperation('get_admin')).toBe(true);
  });

  it('returns true for list prefix', () => {
    expect(isReadOperation('list-tokens')).toBe(true);
    expect(isReadOperation('list_deployed_tokens')).toBe(true);
  });

  it('returns true for other read prefixes', () => {
    expect(isReadOperation('query-balance')).toBe(true);
    expect(isReadOperation('fetch_data')).toBe(true);
    expect(isReadOperation('is_paused')).toBe(true);
    expect(isReadOperation('has-role')).toBe(true);
    expect(isReadOperation('check_status')).toBe(true);
    expect(isReadOperation('count-items')).toBe(true);
  });

  it('returns true for bare read words (no separator)', () => {
    expect(isReadOperation('get')).toBe(true);
    expect(isReadOperation('list')).toBe(true);
  });

  it('returns false for write operations', () => {
    expect(isReadOperation('deploy-token')).toBe(false);
    expect(isReadOperation('transfer')).toBe(false);
    expect(isReadOperation('mint')).toBe(false);
    expect(isReadOperation('burn')).toBe(false);
    expect(isReadOperation('pause')).toBe(false);
  });

  it('does not false-positive on words starting with read prefixes', () => {
    expect(isReadOperation('issue-tokens')).toBe(false);   // not "is"
    expect(isReadOperation('isolate')).toBe(false);        // not "is"
    expect(isReadOperation('gateway')).toBe(false);        // not "get"
    expect(isReadOperation('listing-fee')).toBe(false);    // not "list"
  });
});

// ─── argKey ───────────────────────────────────────────────────────────────────

describe('argKey', () => {
  it('joins path with dots', () => {
    const arg: ArgDef = { name: 'admin', path: ['config', 'admin'], type: 'string', description: '', required: true };
    expect(argKey(arg)).toBe('config.admin');
  });

  it('returns name for top-level args', () => {
    const arg: ArgDef = { name: 'deployer', path: ['deployer'], type: 'string', description: '', required: true };
    expect(argKey(arg)).toBe('deployer');
  });
});

// ─── extractArgs ──────────────────────────────────────────────────────────────

describe('extractArgs', () => {
  it('returns empty array for tool with no properties', () => {
    const tool: ToolInfo = {
      name: 'no-args',
      description: '',
      inputSchema: { type: 'object' },
    };
    expect(extractArgs(tool)).toEqual([]);
  });

  it('extracts flat required and optional args in order', () => {
    const tool: ToolInfo = {
      name: 'deploy-token',
      description: '',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Token name' },
          decimals: { type: 'number', description: 'Decimals' },
          optional_field: { type: 'string', description: 'Optional' },
        },
        required: ['name', 'decimals'],
      },
    };
    const args = extractArgs(tool);
    expect(args).toHaveLength(3);
    // Required args first
    expect(args[0].name).toBe('name');
    expect(args[0].required).toBe(true);
    expect(args[1].name).toBe('decimals');
    expect(args[1].required).toBe(true);
    // Optional after
    expect(args[2].name).toBe('optional_field');
    expect(args[2].required).toBe(false);
  });

  it('recursively expands nested objects into flat args with path and group', () => {
    const tool: ToolInfo = {
      name: 'deploy-token',
      description: '',
      inputSchema: {
        type: 'object',
        properties: {
          deployer: { type: 'string', description: 'Deployer address' },
          config: {
            type: 'object',
            description: 'Token config',
            properties: {
              admin: { type: 'string', description: 'Admin address' },
              decimals: { type: 'number', description: 'Decimals' },
            },
            required: ['admin', 'decimals'],
          },
        },
        required: ['deployer', 'config'],
      },
    };
    const args = extractArgs(tool);
    const deployer = args.find((a) => a.name === 'deployer');
    const admin = args.find((a) => a.name === 'admin');
    const decimals = args.find((a) => a.name === 'decimals');

    expect(deployer?.path).toEqual(['deployer']);
    expect(admin?.path).toEqual(['config', 'admin']);
    expect(admin?.group).toBe('config');
    expect(decimals?.path).toEqual(['config', 'decimals']);
  });

  it('detects discriminated unions (oneOf with tag.const pattern)', () => {
    const tool: ToolInfo = {
      name: 'set-token-type',
      description: '',
      inputSchema: {
        type: 'object',
        properties: {
          token_type: {
            oneOf: [
              { properties: { tag: { const: 'Pausable' } } },
              { properties: { tag: { const: 'Mintable' } } },
              { properties: { tag: { const: 'Burnable' } } },
            ],
          },
        },
        required: ['token_type'],
      },
    };
    const args = extractArgs(tool);
    expect(args).toHaveLength(1);
    expect(args[0].type).toBe('enum');
    expect(args[0].unionTag).toBe(true);
    expect(args[0].enum).toEqual(['Pausable', 'Mintable', 'Burnable']);
  });

  it('handles nullable types (["string", "null"])', () => {
    const tool: ToolInfo = {
      name: 'update',
      description: '',
      inputSchema: {
        type: 'object',
        properties: {
          memo: { type: ['string', 'null'], description: 'Optional memo' },
        },
      },
    };
    const args = extractArgs(tool);
    expect(args[0].nullable).toBe(true);
    expect(args[0].type).toBe('string');
  });
});

// ─── buildToolArgs ────────────────────────────────────────────────────────────

describe('buildToolArgs', () => {
  it('reconstructs flat args into the correct object', () => {
    const args: ArgDef[] = [
      { name: 'deployer', path: ['deployer'], type: 'string', description: '', required: true },
    ];
    const collected = { deployer: 'GABC123' };
    expect(buildToolArgs(args, collected)).toEqual({ deployer: 'GABC123' });
  });

  it('reconstructs nested args by path', () => {
    const args: ArgDef[] = [
      { name: 'deployer', path: ['deployer'], type: 'string', description: '', required: true },
      { name: 'admin', path: ['config', 'admin'], type: 'string', description: '', required: true, group: 'config' },
      { name: 'decimals', path: ['config', 'decimals'], type: 'number', description: '', required: true, group: 'config' },
    ];
    const collected = { deployer: 'GABC', 'config.admin': 'GDEF', 'config.decimals': 7 };
    expect(buildToolArgs(args, collected)).toEqual({
      deployer: 'GABC',
      config: { admin: 'GDEF', decimals: 7 },
    });
  });

  it('wraps unionTag values as { tag: value }', () => {
    const args: ArgDef[] = [
      { name: 'token_type', path: ['token_type'], type: 'enum', description: '', required: true, unionTag: true, enum: ['Pausable', 'Mintable'] },
    ];
    const collected = { token_type: 'Pausable' };
    expect(buildToolArgs(args, collected)).toEqual({ token_type: { tag: 'Pausable' } });
  });

  it('skips args not present in collected', () => {
    const args: ArgDef[] = [
      { name: 'required', path: ['required'], type: 'string', description: '', required: true },
      { name: 'optional', path: ['optional'], type: 'string', description: '', required: false },
    ];
    const collected = { required: 'value' };
    expect(buildToolArgs(args, collected)).toEqual({ required: 'value' });
  });
});

// ─── parseArgValue ────────────────────────────────────────────────────────────

describe('parseArgValue', () => {
  const str: ArgDef = { name: 'x', path: ['x'], type: 'string', description: '', required: true };
  const num: ArgDef = { name: 'x', path: ['x'], type: 'number', description: '', required: true };
  const int: ArgDef = { name: 'x', path: ['x'], type: 'integer', description: '', required: true };
  const bool: ArgDef = { name: 'x', path: ['x'], type: 'boolean', description: '', required: true };
  const obj: ArgDef = { name: 'x', path: ['x'], type: 'object', description: '', required: true };
  const arr: ArgDef = { name: 'x', path: ['x'], type: 'array', description: '', required: true };
  const nullable: ArgDef = { name: 'x', path: ['x'], type: 'string', description: '', required: false, nullable: true };

  it('returns trimmed string for string type', () => {
    expect(parseArgValue('  hello  ', str)).toBe('hello');
  });

  it('parses numbers', () => {
    expect(parseArgValue('42', num)).toBe(42);
    expect(parseArgValue('3.14', num)).toBe(3.14);
    expect(parseArgValue('7', int)).toBe(7);
  });

  it('falls back to string for unparseable numbers', () => {
    expect(parseArgValue('not-a-number', num)).toBe('not-a-number');
  });

  it('parses booleans', () => {
    expect(parseArgValue('true', bool)).toBe(true);
    expect(parseArgValue('True', bool)).toBe(true);
    expect(parseArgValue('1', bool)).toBe(true);
    expect(parseArgValue('yes', bool)).toBe(true);
    expect(parseArgValue('false', bool)).toBe(false);
    expect(parseArgValue('no', bool)).toBe(false);
  });

  it('parses JSON for object type', () => {
    expect(parseArgValue('{"a":1}', obj)).toEqual({ a: 1 });
  });

  it('falls back to string for invalid JSON object', () => {
    expect(parseArgValue('not-json', obj)).toBe('not-json');
  });

  it('parses JSON arrays', () => {
    expect(parseArgValue('[1,2,3]', arr)).toEqual([1, 2, 3]);
  });

  it('returns null for empty nullable arg', () => {
    expect(parseArgValue('', nullable)).toBeNull();
    expect(parseArgValue('  ', nullable)).toBeNull();
  });

  it('returns empty string for empty non-nullable string arg', () => {
    expect(parseArgValue('', str)).toBe('');
  });
});

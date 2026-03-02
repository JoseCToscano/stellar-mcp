/**
 * Stellar MCP — Token Factory dApp
 *
 * Read tab  — query the on-chain token factory (no wallet needed)
 * Write tab — deploy a Soroban token via Freighter browser wallet
 *
 * SDK flow for write:
 *   1. client.call('deploy-token', params)         → unsigned XDR
 *   2. connectFreighter(networkPassphrase)          → { address, signer }
 *   3. client.signAndSubmit(xdr, { signer }) →
 *        a. prepare-transaction (server rebuilds XDR for wallet as source)
 *        b. kit.signTransaction  (Freighter popup — kit already open, no re-connect)
 *        c. submitSignedTransaction (direct to Stellar RPC)
 *        d. pollTransaction (wait for confirmation)
 */

import { MCPClient, connectFreighter, logger } from '@stellar-mcp/client';
import type { Signer } from '@stellar-mcp/client';

// ─── Logging ───────────────────────────────────────────────────────────────────
logger.setLevel('debug');

// ─── Config ────────────────────────────────────────────────────────────────────
const MCP_URL            = import.meta.env.VITE_MCP_URL
                         ?? `${window.location.origin}/mcp`;
const RPC_URL            = import.meta.env.VITE_RPC_URL
                         ?? 'https://soroban-testnet.stellar.org';
const NETWORK_PASSPHRASE = import.meta.env.VITE_NETWORK_PASSPHRASE
                         ?? 'Test SDF Network ; September 2015';

// ─── Error helper ─────────────────────────────────────────────────────────────
function toMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'object' && err !== null) {
    const o = err as Record<string, unknown>;
    if (typeof o.message === 'string') return o.message;
    if (typeof o.error   === 'string') return o.error;
    try { return JSON.stringify(err); } catch { /* ignore */ }
  }
  return String(err);
}

// ─── MCPClient singleton ──────────────────────────────────────────────────────
const client = new MCPClient({ url: MCP_URL, networkPassphrase: NETWORK_PASSPHRASE, rpcUrl: RPC_URL });

// ─── State ─────────────────────────────────────────────────────────────────────
let walletAddress: string | null = null;
let walletSigner:  Signer  | null = null;  // pre-connected signer from connectFreighter()

// ─── DOM helpers ──────────────────────────────────────────────────────────────
const $  = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const $$ = <T extends Element>(sel: string)    => [...document.querySelectorAll<T>(sel)];

// ─── Status badge ──────────────────────────────────────────────────────────────
function setStatus(state: 'connecting' | 'connected' | 'error', text: string) {
  const b = $('status-badge');
  b.className = `badge badge--${state}`;
  b.textContent = text;
}

// ─── Tabs ──────────────────────────────────────────────────────────────────────
$$<HTMLButtonElement>('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab!;
    $$('.tab-btn').forEach(b   => b.classList.remove('active'));
    $$('.tab-panel').forEach(p => p.classList.add('hidden'));
    btn.classList.add('active');
    $(`tab-${tab}`).classList.remove('hidden');
  });
});

// ─── Wallet connection ─────────────────────────────────────────────────────────
async function connectWallet() {
  const btn = $<HTMLButtonElement>('connect-wallet');
  btn.disabled  = true;
  btn.textContent = 'Connecting…';

  try {
    // connectFreighter() handles the entire wallet-kit setup internally.
    // No need to import or configure @creit.tech/stellar-wallets-kit here.
    const { address, signer } = await connectFreighter(NETWORK_PASSPHRASE);

    walletAddress = address;
    walletSigner  = signer;

    // Header
    const short = `${address.slice(0, 6)}…${address.slice(-4)}`;
    btn.textContent = short;
    btn.classList.add('btn-connected');
    $('wallet-info').classList.remove('hidden');
    ($<HTMLElement>('wallet-address-full')).textContent = address;

    // Unlock deploy form
    $('wallet-gate').classList.add('hidden');
    $('deploy-form').classList.remove('hidden');

    // Auto-fill address fields
    (['f-deployer', 'f-admin', 'f-manager'] as const).forEach(id => {
      ($<HTMLInputElement>(id)).value = address;
    });

    // Fill any read-tab wallet-button targets that are empty
    $$<HTMLButtonElement>('[data-target]').forEach(b => {
      const t = $<HTMLInputElement>(b.dataset.target!);
      if (t && !t.value) t.value = address;
    });

    logger.info('Wallet connected', { address });
  } catch (err) {
    btn.disabled  = false;
    btn.textContent = 'Connect Freighter';
    logger.error('Wallet connection failed', { error: String(err) });
  }
}

$('connect-wallet').addEventListener('click', connectWallet);
$('gate-connect-btn').addEventListener('click', connectWallet);

// "↓ Wallet" fill buttons
$$<HTMLButtonElement>('.btn-fill').forEach(btn => {
  btn.addEventListener('click', () => {
    if (!walletAddress) { connectWallet(); return; }
    const t = $<HTMLInputElement>(btn.dataset.target!);
    if (t) t.value = walletAddress;
  });
});

// ─── Token list renderer ───────────────────────────────────────────────────────
interface TokenInfo {
  address:    string;
  name:       string | null;
  admin:      string;
  timestamp:  string;
  token_type: { tag: string };
}

function renderTokens(tokens: TokenInfo[]): string {
  if (!tokens.length) return '<em class="no-results">No tokens found.</em>';
  return tokens.map(t => `
    <div class="token-row">
      <span class="token-symbol">${(t.name ?? 'TKN').slice(0, 4).toUpperCase()}</span>
      <div class="token-info">
        <div class="token-name">${t.name ?? '(unnamed)'}</div>
        <div class="token-id">${t.address}</div>
      </div>
      <span class="token-type">${t.token_type?.tag ?? '—'}</span>
    </div>
  `).join('');
}

// ─── Read queries ──────────────────────────────────────────────────────────────
$$<HTMLButtonElement>('[data-action]').forEach(btn => {
  btn.addEventListener('click', async () => {
    const action   = btn.dataset.action!;
    const resultId = btn.dataset.result!;
    const resultEl = $(resultId);

    btn.disabled    = true;
    btn.textContent = 'Loading…';
    resultEl.classList.remove('hidden');
    resultEl.innerHTML = '<div class="loading">Querying…</div>';

    try {
      let args: Record<string, unknown> = {};

      if (action === 'get-tokens-by-type') {
        const tag = ($<HTMLSelectElement>('filter-type')).value;
        args = { token_type: { tag } };
      } else if (action === 'get-tokens-by-admin') {
        const admin = ($<HTMLInputElement>('filter-admin')).value.trim();
        if (!admin) {
          resultEl.innerHTML = '<em class="no-results">Enter an admin address first.</em>';
          btn.disabled    = false;
          btn.textContent = 'Query';
          return;
        }
        args = { admin };
      }

      // action is a runtime string from data-action — run 'npm run generate' for a
      // fully typed client that eliminates these casts.
      const res = await client.call(action as never, args as never);
      const val = res.simulationResult;

      if (action === 'get-token-count') {
        resultEl.innerHTML = `<span class="result-big">${Number(val)}</span><span class="result-label">tokens</span>`;
      } else if (action === 'get-admin' || action === 'get-pending-admin') {
        const addr = val as string | null;
        resultEl.innerHTML = addr
          ? `<code class="result-address">${addr}</code>`
          : `<em class="no-results">No address set.</em>`;
      } else {
        resultEl.innerHTML = renderTokens((Array.isArray(val) ? val : []) as TokenInfo[]);
      }
    } catch (err) {
      const msg = toMessage(err);
      resultEl.innerHTML = `<span class="result-error">${msg}</span>`;
      logger.error('Query failed', { action, error: msg });
    }

    btn.disabled    = false;
    btn.textContent = 'Query';
  });
});

// ─── Deploy Token (write) ──────────────────────────────────────────────────────
function randomSalt(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

function setTxPanel(html: string) {
  $('tx-panel').innerHTML = html;
}

const STEPS = [
  'Building transaction XDR…',
  'Preparing for wallet (fresh sequence)…',
  'Approve in Freighter…',
  'Submitting to Stellar RPC…',
  'Waiting for confirmation…',
];

function renderSteps(active: number) {
  return `<div class="tx-steps">${
    STEPS.map((label, i) => {
      const n    = i + 1;
      const cls  = n < active ? 'done' : n === active ? 'active' : '';
      const icon = n < active ? '✓' : n === active ? '<span class="spin">◌</span>' : String(n);
      return `<div class="tx-step ${cls}"><span class="tx-step-dot">${icon}</span><span>${label}</span></div>`;
    }).join('')
  }</div>`;
}

$('deploy-form').addEventListener('submit', async e => {
  e.preventDefault();
  if (!walletAddress || !walletSigner) { await connectWallet(); if (!walletSigner) return; }

  const deployer        = ($<HTMLInputElement>('f-deployer')).value.trim();
  const admin           = ($<HTMLInputElement>('f-admin')).value.trim();
  const manager         = ($<HTMLInputElement>('f-manager')).value.trim();
  const name            = ($<HTMLInputElement>('f-name')).value.trim();
  const symbol          = ($<HTMLInputElement>('f-symbol')).value.trim();
  const decimals        = Number(($<HTMLInputElement>('f-decimals')).value);
  const token_type      = ($<HTMLSelectElement>('f-type')).value;
  const initial_supply  = ($<HTMLInputElement>('f-supply')).value.trim() || '0';
  const assetRaw        = ($<HTMLInputElement>('f-asset')).value.trim();
  const capRaw          = ($<HTMLInputElement>('f-cap')).value.trim();

  const deployBtn = $<HTMLButtonElement>('deploy-btn');
  deployBtn.disabled = true;

  // ── Step 1: build XDR ──────────────────────────────────────────────────────
  setTxPanel(renderSteps(1));

  let xdr: string;
  try {
    const result = await client.call('deploy-token' as never, {
      deployer,
      config: {
        admin,
        manager,
        name,
        symbol,
        decimals,
        token_type:     { tag: token_type },
        salt:           randomSalt(),
        initial_supply,
        asset:          assetRaw || null,
        cap:            capRaw   || null,
        decimals_offset: null,
      },
    } as never);

    if (!result.xdr) throw new Error('Server returned no XDR — check contract params.');
    xdr = result.xdr;
  } catch (err) {
    const msg = toMessage(err);
    setTxPanel(`<div class="tx-error"><strong>Build failed:</strong><br>${msg}</div>`);
    deployBtn.disabled  = false;
    logger.error('deploy-token call failed', { error: msg });
    return;
  }

  // ── Steps 2–5: prepare → sign → submit → confirm ──────────────────────────
  setTxPanel(renderSteps(2));

  try {
    // walletSigner is already connected from connectFreighter() — no re-fetch of address
    setTimeout(() => setTxPanel(renderSteps(3)), 800);

    const result = await client.signAndSubmit(xdr, { signer: walletSigner });

    const explorerBase = NETWORK_PASSPHRASE.includes('Public Global Stellar Network')
      ? 'https://stellar.expert/explorer/public'
      : 'https://stellar.expert/explorer/testnet';

    setTxPanel(`
      <div class="tx-success">
        <div class="tx-success-icon">✓</div>
        <div class="tx-success-title">Token Deployed!</div>
        <div class="tx-success-status ${result.status === 'SUCCESS' ? 'ok' : 'fail'}">
          ${result.status}
        </div>
        <div class="tx-hash-label">Transaction</div>
        <a class="tx-hash"
           href="${explorerBase}/tx/${result.hash}"
           target="_blank"
           rel="noopener">
          ${result.hash.slice(0, 16)}…${result.hash.slice(-8)}
        </a>
        <div class="tx-hash-full">${result.hash}</div>
      </div>
    `);

    logger.info('Token deployed', { hash: result.hash, status: result.status });
  } catch (err) {
    const msg = toMessage(err);
    const isUnfunded = /account not found/i.test(msg);
    const friendbotLink = isUnfunded && walletAddress
      ? `<div class="tx-friendbot-wrap"><a class="tx-friendbot" href="https://friendbot.stellar.org/?addr=${walletAddress}" target="_blank" rel="noopener">Fund this account on Friendbot ↗</a><br><span class="tx-friendbot-note">Your testnet wallet has no XLM. Click above to fund it, then try again.</span></div>`
      : '';
    setTxPanel(`<div class="tx-error"><strong>Transaction failed:</strong><br>${msg}${friendbotLink}</div>`);
    logger.error('signAndSubmit failed', { error: msg });
  }

  deployBtn.disabled  = false;
  deployBtn.textContent = 'Build & Sign with Freighter';
});

// ─── Boot: connect to MCP server ───────────────────────────────────────────────
(async () => {
  setStatus('connecting', 'Connecting…');
  try {
    const tools = await client.listTools();
    setStatus('connected', `Connected · ${tools.length} tools`);
    logger.info('MCP ready', { tools: tools.length, url: MCP_URL });
  } catch (err) {
    setStatus('error', 'MCP error');
    logger.error('MCP connection failed', { error: String(err) });
    // Disable query buttons and surface a banner — one clear message beats
    // per-button failures when the server is simply not running.
    $$<HTMLButtonElement>('[data-action]').forEach(btn => { btn.disabled = true; });
    const banner = document.createElement('div');
    banner.id = 'mcp-error-banner';
    banner.textContent = `Cannot reach MCP server at ${MCP_URL} — start the server and refresh.`;
    document.body.prepend(banner);
  }
})();

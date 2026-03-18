# Security Guide

Hardening checklist and best-practice reference for Stellar MCP server deployments. Every section calls out the specific risk, the recommended mitigation, and the exact configuration or library to use.

---

## Table of Contents

1. [Secrets Management](#1-secrets-management)
2. [Rate Limiting](#2-rate-limiting)
3. [CORS](#3-cors)
4. [HTTPS & Transport Security](#4-https--transport-security)
5. [Input Validation](#5-input-validation)
6. [HTTP Security Headers](#6-http-security-headers)
7. [Docker Security](#7-docker-security)
8. [Dependency Security](#8-dependency-security)
9. [Audit Logging](#9-audit-logging)
10. [Stellar-Specific Risks](#10-stellar-specific-risks)

---

## 1. Secrets Management

### What's at stake

`SIGNER_SECRET` is a hot-wallet private key. Anyone who obtains it can drain the wallet instantly. The Stellar network has no fraud reversal.

### Rules

| Rule | Detail |
|---|---|
| Never commit `.env` | Add `.env` to `.gitignore`. Commit `.env.example` only. |
| Never bake secrets into Docker images | Use runtime env injection, not `ARG`/`ENV` in the Dockerfile. |
| One key per environment | Separate keys for dev, staging, and production. |
| Rotate regularly | Set a calendar reminder. Rotation on Stellar is free. |
| Restrict the key's scope | Use [stellar-policy-cli](../stellar-policy-cli/README.md) to generate a policy contract that limits what the key is allowed to sign (function whitelist, amount cap, rate limit). |

### Recommended secret storage

| Deployment | Recommended solution |
|---|---|
| Vercel | Vercel Environment Variables (encrypted at rest, not in repo) |
| Docker / VPS | [Doppler](https://doppler.com) or [Infisical](https://infisical.com) — both have free tiers and inject secrets at runtime |
| AWS | AWS Secrets Manager + IAM role binding |
| Self-hosted | [HashiCorp Vault](https://www.vaultproject.io) |

### Minimum `.gitignore` additions

```
.env
.env.local
.env.*.local
*.pem
*.key
agent-keys.txt
```

---

## 2. Rate Limiting

### What's at stake

Without rate limiting, a single client can flood your server with signing requests, exhaust your Stellar account's XLM (every submitted transaction costs a fee), or cause denial-of-service for legitimate users.

### Recommended library: `rate-limiter-flexible`

[rate-limiter-flexible](https://github.com/animir/node-rate-limiter-flexible) is the professional choice for Node.js rate limiting:
- Framework-agnostic (works with raw `http.Server`, Express, Fastify, etc.)
- In-memory for single instances; Redis/Postgres for distributed deployments
- 4M+ weekly downloads, actively maintained

```bash
npm install rate-limiter-flexible
```

### Single-instance (in-memory)

```typescript
import { RateLimiterMemory } from 'rate-limiter-flexible';

const rateLimiter = new RateLimiterMemory({
  points: parseInt(process.env.RATE_LIMIT ?? '100'), // max requests
  duration: 60,                                       // per 60 seconds per IP
});

async function applyRateLimit(req: http.IncomingMessage, res: http.ServerResponse): Promise<boolean> {
  const ip =
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ??
    req.socket.remoteAddress ??
    'unknown';

  try {
    await rateLimiter.consume(ip);
    return true;
  } catch {
    res.writeHead(429, {
      'Content-Type': 'application/json',
      'Retry-After': '60',
      'X-RateLimit-Limit': String(parseInt(process.env.RATE_LIMIT ?? '100')),
    });
    res.end(JSON.stringify({ error: 'Too Many Requests', retryAfter: 60 }));
    return false;
  }
}
```

### Distributed (multiple instances / Redis)

Required when running multiple server replicas behind a load balancer. In-memory limiters don't share state across processes.

```typescript
import { RateLimiterRedis } from 'rate-limiter-flexible';
import { createClient } from 'redis';

const redisClient = createClient({ url: process.env.REDIS_URL });
await redisClient.connect();

const rateLimiter = new RateLimiterRedis({
  storeClient: redisClient,
  points: parseInt(process.env.RATE_LIMIT ?? '100'),
  duration: 60,
  keyPrefix: 'rl:mcp',
});
```

### Environment variables

| Variable | Default | Description |
|---|---|---|
| `RATE_LIMIT` | `100` | Max requests per IP per minute |

### Vercel note

Vercel functions are already rate-limited at the platform level. Set `RATE_LIMIT` conservatively (e.g. `50`) for the in-code limiter as a second layer.

---

## 3. CORS

### What's at stake

An open `Access-Control-Allow-Origin: *` lets any webpage in any browser make credentialed requests to your MCP server. In practice, the MCP protocol doesn't use cookies, so the risk is lower than for traditional APIs — but it's still best practice to allowlist known origins.

### Configuration

Set `CORS_ORIGINS` to a comma-separated list of allowed origins.

```env
# .env
CORS_ORIGINS=https://myapp.vercel.app,https://staging.myapp.vercel.app
```

### Implementation (no library needed)

```typescript
const CORS_ORIGINS = (process.env.CORS_ORIGINS ?? '*')
  .split(',')
  .map(s => s.trim());

function applyCors(req: http.IncomingMessage, res: http.ServerResponse): void {
  const origin = req.headers.origin ?? '';
  const allowed =
    CORS_ORIGINS.includes('*') || CORS_ORIGINS.includes(origin);

  if (allowed) {
    res.setHeader(
      'Access-Control-Allow-Origin',
      CORS_ORIGINS.includes('*') ? '*' : origin,
    );
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Mcp-Session-Id');
  res.setHeader('Access-Control-Max-Age', '86400');
}
```

Handle preflight requests before any other processing:

```typescript
if (req.method === 'OPTIONS') {
  applyCors(req, res);
  res.writeHead(204);
  res.end();
  return;
}
```

### Environment variables

| Variable | Default | Description |
|---|---|---|
| `CORS_ORIGINS` | `*` | Comma-separated allowed origins. Use `*` for dev only. |

---

## 4. HTTPS & Transport Security

### What's at stake

HTTP transmits `SIGNER_SECRET` and XDR in cleartext. Any network observer (ISP, coffee-shop router, cloud provider) can capture and replay signing requests.

### Deployment-specific guidance

#### Vercel (recommended for quick deploys)
Vercel provisions and renews TLS certificates automatically. No configuration needed. All traffic is HTTPS by default.

#### Self-hosted with [Caddy](https://caddyserver.com) (easiest self-hosted option)
Caddy handles Let's Encrypt certificate provisioning automatically.

```
# Caddyfile
yourdomain.com {
    reverse_proxy localhost:3000
}
```

#### Self-hosted with nginx

```nginx
server {
    listen 443 ssl;
    server_name yourdomain.com;

    ssl_certificate     /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;

    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains" always;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Use [certbot](https://certbot.eff.org) to provision the certificate:

```bash
certbot --nginx -d yourdomain.com
```

### HSTS

Add to every response in production to enforce HTTPS in browsers:

```typescript
res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains');
```

---

## 5. Input Validation

### TypeScript servers (Zod)

Generated TypeScript servers already validate all tool inputs with Zod schemas before they reach the contract. The key additional validations to enforce:

**Stellar address format**
```typescript
import { StrKey } from '@stellar/stellar-sdk';

function isValidStellarAddress(addr: string): boolean {
  return StrKey.isValidEd25519PublicKey(addr);
}
```

**Request body size limit** — prevent memory exhaustion from large payloads:
```typescript
const MAX_BODY_BYTES = 1_048_576; // 1 MB

let size = 0;
for await (const chunk of req) {
  size += chunk.length;
  if (size > MAX_BODY_BYTES) {
    res.writeHead(413, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Payload Too Large' }));
    req.destroy();
    return;
  }
  chunks.push(chunk);
}
```

**Never trust a client-supplied `CONTRACT_ID`** — use the hardcoded value from your environment:
```typescript
// ✅ Good — CONTRACT_ID comes from your env, not from the request
const contractId = process.env.CONTRACT_ID;

// ❌ Bad — never let the caller choose which contract to interact with
const contractId = params.contractId;
```

### Python servers (Pydantic)

Generated Python servers validate inputs via Pydantic schemas. FastMCP performs automatic validation before calling your tool function. No additional configuration is needed for basic type checking.

For Stellar address validation:
```python
from stellar_sdk import StrKey

def is_valid_stellar_address(addr: str) -> bool:
    try:
        StrKey.decode_ed25519_public_key(addr)
        return True
    except Exception:
        return False
```

---

## 6. HTTP Security Headers

Add these to every HTTP response to prevent common web attacks.

```typescript
function applySecurityHeaders(res: http.ServerResponse): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  // In production add:
  // res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains');
}
```

For Express-based servers, use [helmet](https://helmetjs.github.io):
```bash
npm install helmet
```
```typescript
import helmet from 'helmet';
app.use(helmet());
```

---

## 7. Docker Security

### Use a non-root user

The `USER node` (or `USER nobody` for Python) directive prevents container escape escalation.

### TypeScript Dockerfile

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
EXPOSE 3000
# Run as non-root
USER node
CMD ["node", "dist/index.js"]
```

### Python Dockerfile

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY pyproject.toml ./
RUN pip install --no-cache-dir .
COPY . .
EXPOSE 3000
ENV USE_HTTP=true PORT=3000
# Run as non-root
USER nobody
CMD ["python", "server.py"]
```

### `.dockerignore`

```
.env
.env.*
*.pem
*.key
agent-keys.txt
node_modules
__pycache__
.git
```

### Scan images before shipping

```bash
# Docker Scout (built into Docker Desktop 4.17+)
docker scout cves my-mcp-server:latest

# Trivy (open source, CI-friendly)
trivy image my-mcp-server:latest

# Snyk
snyk container test my-mcp-server:latest
```

---

## 8. Dependency Security

### Automated scanning

Run on every CI build:

```bash
# Node.js
npm audit --audit-level=high

# Python
pip install pip-audit
pip-audit
```

### Automated updates

Use [Dependabot](https://docs.github.com/en/code-security/dependabot) or [Renovate](https://docs.renovatebot.com). Both create PRs automatically when new versions of dependencies are available.

**`.github/dependabot.yml`**
```yaml
version: 2
updates:
  - package-ecosystem: npm
    directory: /
    schedule:
      interval: weekly
    open-pull-requests-limit: 5

  - package-ecosystem: pip
    directory: /
    schedule:
      interval: weekly
```

### Pin production lockfiles

Always commit `package-lock.json` / `pnpm-lock.yaml` / `poetry.lock`. Never install without a lockfile in production Docker builds:

```dockerfile
# ✅ Reproducible install
RUN npm ci

# ❌ Installs latest patch releases — unpredictable
RUN npm install
```

---

## 9. Audit Logging

### What to log

Log every write operation (anything that creates a transaction) with enough information to reconstruct what happened — but never log secrets.

```typescript
interface AuditEntry {
  timestamp: string;   // ISO 8601
  tool: string;        // e.g. "deploy-token"
  ip: string;          // client IP (from X-Forwarded-For)
  success: boolean;
  txHash?: string;     // on success
  error?: string;      // on failure (message only, not stack)
}

function auditLog(entry: AuditEntry): void {
  // Write as structured JSON so log aggregators (Datadog, Logtail, CloudWatch) can parse it
  process.stderr.write(JSON.stringify(entry) + '\n');
}
```

### What NOT to log

```typescript
// ❌ Never log any of these
console.log(secretKey);
console.log(xdr);              // XDR contains authorization data
console.log(req.body);         // may contain secretKey
console.log(process.env);      // dumps ALL env vars including SIGNER_SECRET
```

### Log aggregation

| Platform | Solution |
|---|---|
| Vercel | Built-in log drain → Datadog / Logtail / Axiom |
| Docker | `docker logs` → Loki / Datadog agent |
| AWS | CloudWatch Logs |
| Self-hosted | [Logtail](https://logtail.com) (free tier available) |

---

## 10. Stellar-Specific Risks

### Hot wallet key exposure

The `SIGNER_SECRET` gives full spending authority over the associated Stellar account. Treat it like a bank PIN.

**Mitigations:**
1. **Policy contracts** — Use `stellar-policy-cli` to generate a policy contract that enforces: function whitelist, amount caps, rate limiting at the contract level, and recipient whitelists. The policy signer key can only authorize transactions that the policy contract approves.
2. **Minimum balance** — Keep only enough XLM in the signing account to cover fees (0.5 XLM covers ~5,000 transactions). Move earned funds to a cold wallet.
3. **Multi-sig** — For high-value contracts, require 2-of-3 signers. The MCP server holds one key; the others are cold.

### Transaction simulation trust

Soroban simulates every transaction before submission. The simulation result is used to set auth entries and resource limits. If an attacker can intercept the simulation response (MITM on RPC), they could alter what gets signed.

**Mitigation:** Use TLS for all RPC connections. The default testnet and mainnet RPC URLs (`https://soroban-testnet.stellar.org`, `https://soroban.stellar.org`) are already HTTPS.

### Fee exhaustion

Every submitted transaction costs a base fee (currently 100 stroops = 0.00001 XLM), plus resource fees for Soroban operations. A burst of signing requests can drain XLM faster than expected.

**Mitigations:**
- Rate limiting (see Section 2)
- Monitor the signing account balance with a simple cron job or [Stellar Ecosystem Proposal 0-039](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0039.md) webhook

### Secret key in tool parameters

The generated `sign-and-submit` tool accepts `secretKey` as a parameter. **Never send this over unencrypted HTTP.** In production, always require HTTPS (see Section 4) and prefer setting `SIGNER_SECRET` as an environment variable on the server so clients never need to transmit their keys.

### Contract ID injection

If your MCP server allows the caller to supply a `contractId`, an attacker can point it at a malicious contract. Always use a hardcoded `CONTRACT_ID` from your environment (see Section 5).

---

## Quick-Reference Checklist

```
[ ] SIGNER_SECRET stored in secret manager, not .env committed to git
[ ] Separate signing keys per environment (dev / staging / prod)
[ ] Policy contract limits what the key can sign
[ ] Rate limiting enabled (RATE_LIMIT env var set)
[ ] CORS_ORIGINS set to explicit allowlist (not *)
[ ] HTTPS enforced — HTTP rejected or redirected
[ ] HSTS header set in production
[ ] Security headers applied (X-Content-Type-Options, X-Frame-Options, etc.)
[ ] Docker: non-root USER, minimal base image, .dockerignore excludes .env
[ ] npm audit / pip-audit running in CI
[ ] Dependabot or Renovate enabled
[ ] Audit logging for all write operations (no secrets in logs)
[ ] Signing account has minimum balance only
[ ] CONTRACT_ID is hardcoded from env, not caller-supplied
```

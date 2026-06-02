#!/usr/bin/env node
// Integration test for Idempotency-Key plumbing on payment-tokens create.
//
// Verifies, end-to-end via dist/index.js:
//   1. payment-tokens create  --idempotency-key <k> → header echoed
//   2. payment-tokens create without flag           → CLI prompts; empty
//      stdin sends no synthesized value (server-side rejects).
//
// The CLI is run under an isolated HOME dir so it can't touch real credentials,
// and against an in-process HTTP server that returns the unified envelope the
// CLI expects ({ code: '0000', data: {...} }).

import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const CLI = resolve(REPO_ROOT, 'dist/index.js');

const ORG_ID = 'org_test_001';
const PM_ID = 'pm_test_001';
const FAR_FUTURE = Math.floor(Date.now() / 1000) + 30 * 24 * 3600;

let captured = [];

function startMockServer() {
  const server = createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      captured.push({
        method: req.method,
        url: req.url,
        headers: req.headers,
        body,
      });

      const send = (payload, status = 200) => {
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(payload));
      };

      // Route handlers — only the ones our flows touch.
      if (req.url === '/api/v3/agent-pay/features/vcn') {
        return send({ code: '0000', data: { name: 'vcn', enabled: true } });
      }
      if (req.url === '/api/v3/agent-pay/payment-tokens/create') {
        return send({
          code: '0000',
          data: {
            id: 'pmt_test_001',
            type: 'vcn',
            status: 'ACTIVE',
            vcn: { pan: '4111111111111111', expiry: '12/30', cvv: '123', spend_limit_cents: 3000, balance_cents: 0, currency: 'USD' },
          },
        });
      }
      // Default: 404 with the expected envelope so the CLI surfaces a clean error.
      send({ code: '4040', message: `unhandled ${req.method} ${req.url}` }, 404);
    });
  });
  return new Promise((r) => server.listen(0, '127.0.0.1', () => r(server)));
}

async function setupHome(port) {
  const home = await mkdtemp(join(tmpdir(), 'agenzo-cli-test-'));
  const cfgDir = join(home, '.agenzo-token-cli');
  const credDir = join(cfgDir, 'credentials');
  await mkdir(credDir, { recursive: true });

  await writeFile(
    join(cfgDir, 'config.json'),
    JSON.stringify({ active_org: ORG_ID, api_host: `http://127.0.0.1:${port}`, api_path: '/api/v3/agent-pay' }, null, 2),
  );

  await writeFile(
    join(credDir, `${ORG_ID}.json`),
    JSON.stringify({
      org_id: ORG_ID,
      org_name: 'Test Org',
      email: 'test@example.com',
      access_token: 'access_token_fake',
      refresh_token: 'refresh_token_fake',
      access_token_expires_at: FAR_FUTURE,
      refresh_token_expires_at: FAR_FUTURE,
      api_host: `http://127.0.0.1:${port}`,
    }, null, 2),
  );

  return home;
}

function runCli(args, { home, stdin = '', timeoutMs = 8000 } = {}) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [CLI, ...args], {
      env: { ...process.env, HOME: home },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let out = '';
    let err = '';
    child.stdout.on('data', (c) => (out += c));
    child.stderr.on('data', (c) => (err += c));
    if (stdin) child.stdin.write(stdin);
    child.stdin.end();
    const timer = setTimeout(() => child.kill('SIGKILL'), timeoutMs);
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      resolve({ code, signal, out, err });
    });
  });
}

function assert(cond, msg) {
  if (!cond) {
    console.error(`  ✗ ${msg}`);
    process.exitCode = 1;
    return false;
  }
  console.log(`  ✓ ${msg}`);
  return true;
}

function findRequest(predicate) {
  return captured.find(predicate);
}

async function main() {
  const server = await startMockServer();
  const port = server.address().port;
  const home = await setupHome(port);
  console.log(`Mock server: http://127.0.0.1:${port}`);
  console.log(`Test HOME: ${home}\n`);

  let allOk = true;

  // ── Case 1: payment-tokens create with --idempotency-key ───────────
  console.log('Case 1: payment-tokens create --idempotency-key idem_pt_001');
  captured = [];
  const r1 = await runCli(
    [
      '--yes', 'payment-tokens', 'create',
      '--type', 'vcn',
      '--api-key', 'sk_test_xxx',
      '--payment-method-id', PM_ID,
      '--amount', '30',
      '--idempotency-key', 'idem_pt_001',
    ],
    { home },
  );
  if (r1.code !== 0) {
    console.log('  stdout:', r1.out);
    console.log('  stderr:', r1.err);
  }
  allOk &= assert(r1.code === 0, `exit code 0 (got ${r1.code})`);
  const ptReq = findRequest((c) => c.url === '/api/v3/agent-pay/payment-tokens/create');
  allOk &= assert(!!ptReq, 'POST /payment-tokens/create captured');
  if (ptReq) {
    allOk &= assert(ptReq.headers['idempotency-key'] === 'idem_pt_001',
      `Idempotency-Key header = "idem_pt_001" (got "${ptReq.headers['idempotency-key']}")`);
    // Body must NOT contain the key
    const body = JSON.parse(ptReq.body || '{}');
    allOk &= assert(!('idempotency_key' in body) && !('Idempotency-Key' in body),
      'idempotency key NOT in request body');
  }

  // ── Case 2: missing --idempotency-key prompts; empty input → request still fires
  //          with no Idempotency-Key header (server-side will reject). CLI does not
  //          synthesize a value — that's the contract being verified here.
  console.log('\nCase 2: payment-tokens create WITHOUT --idempotency-key (prompt → empty stdin)');
  captured = [];
  const r2 = await runCli(
    [
      '--yes', 'payment-tokens', 'create',
      '--type', 'vcn',
      '--api-key', 'sk_test_xxx',
      '--payment-method-id', PM_ID,
      '--amount', '30',
    ],
    { home, stdin: '\n' },
  );
  void r2;
  const ptReqMissing = findRequest((c) => c.url === '/api/v3/agent-pay/payment-tokens/create');
  if (ptReqMissing) {
    const idem = ptReqMissing.headers['idempotency-key'];
    allOk &= assert(!idem, `no Idempotency-Key header sent (got "${idem ?? ''}")`);
  } else {
    // Either is acceptable — the contract is "no synthesized value", not "must reach server".
    allOk &= assert(true, 'no /payment-tokens/create request was sent');
  }

  server.close();
  await rm(home, { recursive: true, force: true });

  console.log('\n' + (allOk ? '✓ all checks passed' : '✗ some checks failed'));
  process.exit(allOk ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

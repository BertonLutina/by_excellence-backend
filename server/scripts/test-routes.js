/**
 * Test that API routes respond. Run with: node scripts/test-routes.js
 * Requires: backend server running (npm run dev). Full pass requires DB + schema (see config/schema.sql).
 */
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:4000';
const BASE = `${API_BASE_URL}/api`;

const log = (name, ok, detail = '') => {
  const s = ok ? '✓' : '✗';
  console.log(`  ${s} ${name}${detail ? ` — ${detail}` : ''}`);
};

async function request(method, path, body = null, token = null) {
  const url = path.startsWith('http') ? path : `${BASE}${path}`;
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (token) opts.headers['Authorization'] = `Bearer ${token}`;
  if (body && method !== 'GET') opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: res.status, data };
}

async function run() {
  console.log('Testing routes at', BASE, '\n');

  let token = null;
  let passed = 0;
  let failed = 0;

  // --- Health ---
  try {
    const { status, data } = await request('GET', '/health');
    const ok = status === 200 && data?.status === 'ok';
    log('GET /api/health', ok, ok ? '' : `status=${status}`);
    ok ? passed++ : failed++;
  } catch (e) {
    log('GET /api/health', false, e.message);
    failed++;
  }

  // --- Public GET (optional auth). 500 = route exists but DB/config error ---
  try {
    const { status, data } = await request('GET', '/service-categories');
    const ok = status === 200 || status === 401;
    log('GET /api/service-categories', ok, ok ? `status=${status}` : `status=${status} ${data?.error || ''}`);
    ok ? passed++ : failed++;
  } catch (e) {
    log('GET /api/service-categories', false, e.message);
    failed++;
  }

  try {
    const { status, data } = await request('GET', '/providers');
    const ok = status === 200 || status === 401;
    log('GET /api/providers', ok, ok ? `status=${status}` : `status=${status} ${data?.error || ''}`);
    ok ? passed++ : failed++;
  } catch (e) {
    log('GET /api/providers', false, e.message);
    failed++;
  }

  // --- Auth: register + login ---
  const testEmail = `test-${Date.now()}@example.com`;
  try {
    const reg = await request('POST', '/auth/register', {
      email: testEmail,
      password: 'TestPass123!',
      full_name: 'Route Test',
      role: 'client',
    });
    const ok = reg.status === 201 && reg.data?.token;
    log('POST /api/auth/register', ok, ok ? '' : `status=${reg.status} ${reg.data?.error || ''}`);
    if (ok) token = reg.data.token;
    ok ? passed++ : failed++;
  } catch (e) {
    log('POST /api/auth/register', false, e.message);
    failed++;
  }

  try {
    const login = await request('POST', '/auth/login', {
      email: testEmail,
      password: 'TestPass123!',
    });
    const ok = login.status === 200 && login.data?.token;
    log('POST /api/auth/login', ok, ok ? '' : `status=${login.status} ${login.data?.error || ''}`);
    if (ok) token = login.data.token;
    ok ? passed++ : failed++;
  } catch (e) {
    log('POST /api/auth/login', false, e.message);
    failed++;
  }

  // --- Protected with token ---
  if (token) {
    try {
      const { status } = await request('GET', '/auth/me', null, token);
      log('GET /api/auth/me', status === 200, `status=${status}`);
      status === 200 ? passed++ : failed++;
    } catch (e) {
      log('GET /api/auth/me', false, e.message);
      failed++;
    }

    try {
      const { status } = await request('GET', '/service-categories', null, token);
      log('GET /api/service-categories (auth)', status === 200, `status=${status}`);
      status === 200 ? passed++ : failed++;
    } catch (e) {
      log('GET /api/service-categories (auth)', false, e.message);
      failed++;
    }
  }

  console.log('\n--- Summary ---');
  console.log(`  Passed: ${passed}, Failed: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error('Script error:', err.message);
  if (err.cause?.code === 'ECONNREFUSED') {
    console.error('\nIs the backend server running? Try: cd backend && npm run dev');
  }
  process.exit(1);
});

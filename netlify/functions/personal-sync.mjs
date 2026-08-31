import { getStore } from '@netlify/blobs';

const STORE_NAME = 'morning-report-personal-sync';
const NAMESPACES = new Set(['cards', 'journal']);
const SYNC_ID_RE = /^[a-f0-9]{64}$/;
const MAX_CIPHERTEXT_LENGTH = 2_000_000;

const json = (payload, status = 200) => new Response(JSON.stringify(payload), {
  status,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  }
});

const allowedOrigin = (request) => {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  try {
    const host = new URL(origin).hostname;
    return host === 'mymorningintelligencereport.netlify.app'
      || host === 'mymorningintelligencereport.com'
      || host === 'www.mymorningintelligencereport.com'
      || host.endsWith('--mymorningintelligencereport.netlify.app');
  } catch {
    return false;
  }
};

const clean = (value, max = 200) => String(value || '').trim().slice(0, max);

const validEncryptedRecord = (payload) => {
  const iv = clean(payload?.iv, 100);
  const ciphertext = String(payload?.ciphertext || '');
  return /^[A-Za-z0-9_-]{8,100}$/.test(iv)
    && /^[A-Za-z0-9_-]+$/.test(ciphertext)
    && ciphertext.length <= MAX_CIPHERTEXT_LENGTH;
};

export default async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204 });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!allowedOrigin(request)) return json({ error: 'Origin not allowed' }, 403);

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const action = clean(payload?.action, 20);
  const syncId = clean(payload?.sync_id, 64).toLowerCase();
  const namespace = clean(payload?.namespace, 30).toLowerCase();

  if (!SYNC_ID_RE.test(syncId) || !NAMESPACES.has(namespace)) {
    return json({ error: 'Invalid sync request' }, 400);
  }

  const store = getStore({ name: STORE_NAME, consistency: 'strong' });
  const key = `v1/${syncId}/${namespace}`;

  if (action === 'load') {
    const record = await store.get(key, { type: 'json' });
    if (!record) return json({ ok: true, found: false });
    return json({
      ok: true,
      found: true,
      record: {
        version: 1,
        iv: record.iv,
        ciphertext: record.ciphertext,
        client_updated_at: record.client_updated_at || null,
        server_updated_at: record.server_updated_at || null
      }
    });
  }

  if (action === 'save') {
    if (!validEncryptedRecord(payload)) {
      return json({ error: 'Invalid encrypted payload' }, 400);
    }

    const record = {
      version: 1,
      iv: clean(payload.iv, 100),
      ciphertext: String(payload.ciphertext),
      client_updated_at: clean(payload.client_updated_at, 50) || null,
      server_updated_at: new Date().toISOString()
    };

    await store.setJSON(key, record);
    return json({ ok: true, saved: true, server_updated_at: record.server_updated_at });
  }

  return json({ error: 'Unknown action' }, 400);
};

export const config = { path: '/api/personal-sync' };

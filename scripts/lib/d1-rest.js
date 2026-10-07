/**
 * Client D1 qua REST cho script chay tay (CommonJS, khong `server-only`).
 * Ban sao toi gian cua lib/server/db/d1.ts — script khong import duoc TypeScript cua app.
 *
 * Bien moi truong (.env.local): CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN, CLOUDFLARE_D1_DATABASE_ID
 * (mac dinh doc `database_id` tu wrangler.jsonc). KHONG in token ra log. Moi SQL phai tham so hoa.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const RETRIES = 5;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function loadEnv() {
  const envPath = path.join(ROOT, '.env.local');
  if (fs.existsSync(envPath) && typeof process.loadEnvFile === 'function') process.loadEnvFile(envPath);
}

function config() {
  loadEnv();
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const token = process.env.CLOUDFLARE_API_TOKEN;
  let databaseId = process.env.CLOUDFLARE_D1_DATABASE_ID;
  if (!databaseId) {
    try {
      databaseId = /"database_id"\s*:\s*"([0-9a-f-]{36})"/.exec(fs.readFileSync(path.join(ROOT, 'wrangler.jsonc'), 'utf8'))?.[1];
    } catch {
      /* bao thieu ben duoi */
    }
  }
  const missing = [!accountId && 'CLOUDFLARE_ACCOUNT_ID', !token && 'CLOUDFLARE_API_TOKEN', !databaseId && 'CLOUDFLARE_D1_DATABASE_ID'].filter(Boolean);
  if (missing.length > 0) {
    console.error(`\nLỗi: thiếu cấu hình Cloudflare: ${missing.join(', ')} (.env.local).`);
    process.exit(1);
  }
  return { url: `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`, token };
}

/** Chay mot mang {sql, params} nhu MOT transaction. Tra ve mang ket qua ({results, meta}). */
async function batch(cfg, statements) {
  for (let attempt = 1; ; attempt += 1) {
    let res;
    try {
      res = await fetch(cfg.url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${cfg.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(statements.length === 1 ? statements[0] : { batch: statements }),
      });
    } catch (err) {
      if (attempt >= RETRIES) throw new Error(`Không gọi được D1: ${err.message}`);
      await sleep(1000 * 2 ** attempt);
      continue;
    }
    if ((res.status === 429 || res.status >= 500) && attempt < RETRIES) {
      await sleep(Number(res.headers.get('retry-after')) * 1000 || 1000 * 2 ** attempt);
      continue;
    }
    const body = await res.json().catch(() => null);
    if (!res.ok || !body?.success) {
      const detail = (body?.errors ?? []).map((e) => `${e.code}: ${e.message}`).join('; ') || `HTTP ${res.status}`;
      throw new Error(`D1 từ chối batch (${statements.length} câu): ${detail}`);
    }
    return body.result;
  }
}

const rowsWritten = (results) => results.reduce((n, r) => n + (r?.meta?.rows_written ?? 0), 0);

module.exports = { config, batch, rowsWritten };

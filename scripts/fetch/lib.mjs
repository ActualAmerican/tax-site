// Lightweight helpers for live fetching and writing normalized JSON
import fs from 'node:fs';
import path from 'node:path';

export function today() {
  return new Date().toISOString().slice(0, 10);
}

export async function httpGet(url, opts = {}) {
  const res = await fetch(url, { redirect: 'follow', ...opts });
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
  const ct = (res.headers.get('content-type') || '').toLowerCase();
  if (ct.includes('application/json')) return await res.json();
  return await res.text();
}

export function ensureDirFor(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

export function writeJSON(filePath, obj) {
  ensureDirFor(filePath);
  fs.writeFileSync(filePath, JSON.stringify(obj, null, 2));
}

export function readJSON(filePath) {
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch { return null; }
}

export function sourcesPath(dateStr, name) {
  return path.resolve(`data/sources/${dateStr}/${name}.json`);
}

export function partialsPath(name) {
  return path.resolve(`data/partials/${name}.json`);
}

export function provenance(url, checked_at, effective_date) {
  return { source_url: url, checked_at, effective_date };
}

export function log(msg) { console.log(msg); }


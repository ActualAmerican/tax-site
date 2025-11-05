#!/usr/bin/env node
// Ensures LIVE_SOURCES runs actually produced partials with non-zero sizes.
import fs from 'node:fs';
import path from 'node:path';

const LIVE = process.env.LIVE_SOURCES === '1';
if (!LIVE) { console.log('check-partials: LIVE_SOURCES not set; skipping.'); process.exit(0); }

const MUST = ['income','sales','property','fuel','excise'];
function count(name){
  const p = path.resolve('data/partials', `${name}.json`);
  if (!fs.existsSync(p)) return 0;
  try { const arr = JSON.parse(fs.readFileSync(p,'utf8')); return Array.isArray(arr)? arr.length : 0; } catch { return 0; }
}

const bad = [];
for (const m of MUST){ const n = count(m); console.log(`[${m}] rows=${n}`); if (n === 0) bad.push(m); }
if (bad.length){ console.error(`Missing partials for: ${bad.join(', ')}`); process.exit(1); }
console.log('check-partials: OK');


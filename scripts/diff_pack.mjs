#!/usr/bin/env node
import fs from 'node:fs';
import child from 'node:child_process';

const PATH = 'data/packs/2025.1.0.composed.json';

function readJSON(p){ try { return JSON.parse(fs.readFileSync(p,'utf8')); } catch { return null; } }
function readPrevFromGit(p){
  try {
    const txt = child.execSync(`git show HEAD:${p}`, { stdio: ['ignore','pipe','pipe'] }).toString('utf8');
    return JSON.parse(txt);
  } catch { return null; }
}

const cur = readJSON(PATH);
const prev = readPrevFromGit(PATH);

if (!cur || !prev) {
  console.log('[diff] No previous composed pack to diff.');
  process.exit(0);
}

function mapBy(arr, key){ const m=new Map(); (arr||[]).forEach(r=>m.set(r[key], r)); return m; }

const out = { changed: [], timestamp: new Date().toISOString(), version: cur.registry?.pack_version };

for (const metric of ['income','sales','property','fuel','excise']) {
  const before = mapBy(prev[metric]||[], 'state');
  const after  = mapBy(cur[metric]||[], 'state');
  const states = new Set([...before.keys(), ...after.keys()]);
  for (const s of states) {
    const a = before.get(s) || {};
    const b = after.get(s) || {};
    const rec = { metric, state: s, changes: [] };
    const fields = {
      income: ['has_income_tax','standard_deduction','flat','brackets'],
      sales: ['state_rate','avg_local_rate','combined_rate'],
      property: ['effective_rate'],
      fuel: ['cents_per_gallon'],
      excise: ['cigarette_per_pack','alcohol_per_unit','beer_per_gal']
    }[metric];
    for (const f of fields) {
      const va = JSON.stringify(a?.[f] ?? null);
      const vb = JSON.stringify(b?.[f] ?? null);
      if (va !== vb) rec.changes.push({ field: f, before: a?.[f] ?? null, after: b?.[f] ?? null });
    }
    if (rec.changes.length) out.changed.push(rec);
  }
}

fs.mkdirSync('public/pack', { recursive: true });
fs.writeFileSync('public/pack/latest.json', JSON.stringify({
  version: cur.registry?.pack_version,
  built_at: cur.registry?.built_at,
  hash: cur.registry?.hash,
  diff: out
}, null, 2));

console.log(`[diff] Wrote public/pack/latest.json with ${out.changed.length} changed entries.`);


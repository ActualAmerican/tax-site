#!/usr/bin/env node
// Runs all fetchers. When LIVE_SOURCES=1, requires that each fetcher
// produce at least 5 rows (or a federal object), else exits 1.
import { readFileSync } from 'node:fs';
import { existsSync } from 'node:fs';
import path from 'node:path';

const LIVE = process.env.LIVE_SOURCES === '1';
const DATE = process.env.SOURCES_DATE || new Date().toISOString().slice(0,10);

const root = process.cwd();
const metrics = ['income','sales','property','fuel','excise','federal'];

function sizeFor(name){
  try {
    const p = path.resolve('data/partials', `${name}.json`);
    if (!existsSync(p)) return 0;
    const txt = readFileSync(p, 'utf8');
    if (name === 'federal') return txt.trim().length ? 1 : 0;
    const arr = JSON.parse(txt);
    return Array.isArray(arr) ? arr.length : 0;
  } catch { return 0; }
}

async function run(cmd){
  const { spawn } = await import('node:child_process');
  return new Promise((resolve, reject) => {
    const p = spawn(process.execPath, [cmd], { stdio: 'inherit', env: process.env });
    p.on('exit', (code) => code === 0 ? resolve(0) : reject(new Error(`${cmd} exited ${code}`)));
  });
}

async function main(){
  console.log(`fetch-orchestrate: LIVE=${LIVE?'1':'0'} DATE=${DATE}`);
  for (const m of metrics) {
    const script = `scripts/fetch/fetch_${m}.mjs`;
    await run(script).catch((e)=>{ if (LIVE) throw e; else console.warn(e.message); });
    const n = sizeFor(m);
    console.log(`[${m}] partial size: ${n}`);
    if (LIVE && ((m==='federal' && n<1) || (m!=='federal' && n<5))) {
      throw new Error(`[${m}] produced too few rows in LIVE mode`);
    }
  }
  console.log('fetch-orchestrate: all fetchers completed.');
}

main().catch((e)=>{ console.error(e.message || e); process.exit(1); });


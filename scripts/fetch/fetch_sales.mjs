#!/usr/bin/env node
// Fetches/normalizes state + avg local sales tax rates.
import fs from 'node:fs';
import path from 'node:path';
import { today, httpGet, writeJSON, readJSON, sourcesPath, partialsPath, provenance, log } from './lib.mjs';

const LIVE = process.env.LIVE_SOURCES === '1';
const DATE = process.env.SOURCES_DATE || today();
const OUT = partialsPath('sales');

async function fetchLive() {
  // NOTE: Upstream may change paths; this is intentionally conservative.
  // Prefer a JSON/CSV snapshot placed by CI if scraping fails.
  const candidates = [
    // Known Tax Foundation landing (HTML table). Slug may change yearly.
    'https://taxfoundation.org/data/all/state/state-and-local-sales-tax-rates/',
    'https://taxfoundation.org/data/all/state/sales-taxes/state-and-local-sales-tax-rates/'
  ];
  for (const url of candidates) {
    try {
      const html = await httpGet(url);
      // Minimal table extractor: look for rows like "Alabama 4.00% 5.25% 9.25%".
      const lines = String(html).split(/\n|<tr/gi);
      const rows = [];
      for (const L of lines) {
        const m = L.replace(/<[^>]+>/g,' ').replace(/&[^;]+;/g,' ').trim();
        const mm = m.match(/\b([A-Z][a-z]+)\b\s+(\d+\.\d+)%\s+(\d+\.\d+)%\s+(\d+\.\d+)%/);
        if (!mm) continue;
        const name = mm[1];
        const map = {
          Alabama:'AL', Alaska:'AK', Arizona:'AZ', Arkansas:'AR', California:'CA', Colorado:'CO', Connecticut:'CT',
          Delaware:'DE', 'District of Columbia':'DC', Florida:'FL', Georgia:'GA', Hawaii:'HI', Idaho:'ID', Illinois:'IL',
          Indiana:'IN', Iowa:'IA', Kansas:'KS', Kentucky:'KY', Louisiana:'LA', Maine:'ME', Maryland:'MD', Massachusetts:'MA',
          Michigan:'MI', Minnesota:'MN', Mississippi:'MS', Missouri:'MO', Montana:'MT', Nebraska:'NE', Nevada:'NV',
          'New Hampshire':'NH', 'New Jersey':'NJ', 'New Mexico':'NM', 'New York':'NY', 'North Carolina':'NC', 'North Dakota':'ND',
          Ohio:'OH', Oklahoma:'OK', Oregon:'OR', Pennsylvania:'PA', 'Rhode Island':'RI', 'South Carolina':'SC', 'South Dakota':'SD',
          Tennessee:'TN', Texas:'TX', Utah:'UT', Vermont:'VT', Virginia:'VA', Washington:'WA', 'West Virginia':'WV', Wisconsin:'WI', Wyoming:'WY'
        };
        const state = map[name];
        if (!state) continue;
        const state_rate = Number(mm[2])/100; const avg_local_rate = Number(mm[3])/100; const combined_rate = Number(mm[4])/100;
        rows.push({ state, year: 2025, state_rate, avg_local_rate, combined_rate, ...provenance(url, DATE, `${DATE}`) });
      }
      if (rows.length) return rows;
    } catch (e) { log(`[sales] live fetch from ${url} failed: ${e.message}`); }
  }
  return [];
}

async function main(){
  let rows = [];
  if (LIVE) rows = await fetchLive();
  if (!rows.length) {
    const IN = sourcesPath(DATE, 'sales');
    const src = readJSON(IN);
    rows = Array.isArray(src) ? src : [];
    if (!rows.length) console.warn(`[sales] No source at ${IN}`);
  }
  writeJSON(OUT, rows);
  console.log(`[sales] Wrote ${rows.length} rows to ${OUT}`);
}

main().catch((e)=>{ console.error(e); process.exit(1); });

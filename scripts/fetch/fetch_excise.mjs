#!/usr/bin/env node
// Cigarette excise per pack; optional placeholders for alcohol.
import { today, httpGet, writeJSON, readJSON, sourcesPath, partialsPath, provenance, log } from './lib.mjs';

const LIVE = process.env.LIVE_SOURCES === '1';
const DATE = process.env.SOURCES_DATE || today();
const OUT = partialsPath('excise');

const NAME_TO_USPS = {
  Alabama:'AL', Alaska:'AK', Arizona:'AZ', Arkansas:'AR', California:'CA', Colorado:'CO', Connecticut:'CT',
  Delaware:'DE', 'District of Columbia':'DC', Florida:'FL', Georgia:'GA', Hawaii:'HI', Idaho:'ID', Illinois:'IL',
  Indiana:'IN', Iowa:'IA', Kansas:'KS', Kentucky:'KY', Louisiana:'LA', Maine:'ME', Maryland:'MD', Massachusetts:'MA',
  Michigan:'MI', Minnesota:'MN', Mississippi:'MS', Missouri:'MO', Montana:'MT', Nebraska:'NE', Nevada:'NV',
  'New Hampshire':'NH', 'New Jersey':'NJ', 'New Mexico':'NM', 'New York':'NY', 'North Carolina':'NC', 'North Dakota':'ND',
  Ohio:'OH', Oklahoma:'OK', Oregon:'OR', Pennsylvania:'PA', 'Rhode Island':'RI', 'South Carolina':'SC', 'South Dakota':'SD',
  Tennessee:'TN', Texas:'TX', Utah:'UT', Vermont:'VT', Virginia:'VA', Washington:'WA', 'West Virginia':'WV', Wisconsin:'WI', Wyoming:'WY'
};

async function fetchLive(){
  const candidates = [
    'https://taxfoundation.org/data/all/state/cigarette-tax-rates-by-state/',
  ];
  for (const url of candidates) {
    try {
      const html = await httpGet(url);
      const lines = String(html).split(/\n|<tr/gi);
      const rows = [];
      for (const L of lines) {
        const t = L.replace(/<[^>]+>/g,' ').replace(/&[^;]+;/g,' ').trim();
        // Pattern: Alabama $0.675 per pack
        const mm = t.match(/\b([A-Z][a-z]+(?:\s[A-Z][a-z]+)*)\b\s+\$?(\d+\.?\d*)\s*(?:per\s*pack|)/i);
        if (!mm) continue;
        const name = mm[1];
        const state = NAME_TO_USPS[name];
        if (!state) continue;
        const perPack = Number(mm[2]);
        rows.push({ state, year: 2025, cigarette_per_pack: perPack, cigarette_unit:'per_pack', alcohol_per_unit:0, alcohol_unit:'per_unit', ...provenance(url, DATE, DATE) });
      }
      if (rows.length) return rows;
    } catch (e) { log(`[excise] live fetch failed: ${e.message}`); }
  }
  return [];
}

async function main(){
  let rows = [];
  if (LIVE) rows = await fetchLive();
  if (!rows.length) {
    const IN = sourcesPath(DATE, 'excise');
    const src = readJSON(IN);
    rows = Array.isArray(src) ? src : [];
    if (!rows.length) console.warn(`[excise] No source at ${IN}`);
  }
  writeJSON(OUT, rows);
  console.log(`[excise] Wrote ${rows.length} rows to ${OUT}`);
}

main().catch((e)=>{ console.error(e); process.exit(1); });

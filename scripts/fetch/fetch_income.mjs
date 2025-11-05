#!/usr/bin/env node
// State individual income tax (flat/bracket + std deduction if applicable).
import { today, httpGet, writeJSON, readJSON, sourcesPath, partialsPath, provenance, log } from './lib.mjs';

const LIVE = process.env.LIVE_SOURCES === '1';
const DATE = process.env.SOURCES_DATE || today();
const OUT = partialsPath('income');

const NAME_TO_USPS = {
  Alabama:'AL', Alaska:'AK', Arizona:'AZ', Arkansas:'AR', California:'CA', Colorado:'CO', Connecticut:'CT',
  Delaware:'DE', 'District of Columbia':'DC', Florida:'FL', Georgia:'GA', Hawaii:'HI', Idaho:'ID', Illinois:'IL',
  Indiana:'IN', Iowa:'IA', Kansas:'KS', Kentucky:'KY', Louisiana:'LA', Maine:'ME', Maryland:'MD', Massachusetts:'MA',
  Michigan:'MI', Minnesota:'MN', Mississippi:'MS', Missouri:'MO', Montana:'MT', Nebraska:'NE', Nevada:'NV',
  'New Hampshire':'NH', 'New Jersey':'NJ', 'New Mexico':'NM', 'New York':'NY', 'North Carolina':'NC', 'North Dakota':'ND',
  Ohio:'OH', Oklahoma:'OK', Oregon:'OR', Pennsylvania:'PA', 'Rhode Island':'RI', 'South Carolina':'SC', 'South Dakota':'SD',
  Tennessee:'TN', Texas:'TX', Utah:'UT', Vermont:'VT', Virginia:'VA', Washington:'WA', 'West Virginia':'WV', Wisconsin:'WI', Wyoming:'WY'
};

function emptyRow(state){ return { state, year: 2025, has_income_tax: false, standard_deduction: 0, flat: null, brackets: [], ...provenance('about:blank', DATE, '2025-01-01') }; }

async function fetchLive(){
  // Tax Foundation page has a “individual income tax rates and brackets” table.
  const url = 'https://taxfoundation.org/data/all/state/state-individual-income-tax-rates-and-brackets/';
  try {
    const html = await httpGet(url);
    const lines = String(html).split(/\n|<tr/gi);
    const byState = new Map();
    for (const L of lines) {
      const t = L.replace(/<[^>]+>/g,' ').replace(/&[^;]+;/g,' ').trim();
      // Try to detect flat tax: "Indiana 3.05% flat"; bracketed: "California 1.0% ... 9.3%".
      const flat = t.match(/\b([A-Z][a-z]+(?:\s[A-Z][a-z]+)*)\b\s+(\d+\.\d+)%\s+flat/i);
      if (flat) {
        const st = NAME_TO_USPS[flat[1]]; if (!st) continue;
        const rate = Number(flat[2])/100;
        byState.set(st, { state: st, year: 2025, has_income_tax: true, standard_deduction: 0, flat: rate, brackets: null, ...provenance(url, DATE, '2025-01-01') });
        continue;
      }
      const none = t.match(/\b([A-Z][a-z]+(?:\s[A-Z][a-z]+)*)\b\s+No\s+income\s+tax/i);
      if (none) { const st = NAME_TO_USPS[none[1]]; if (st) byState.set(st, emptyRow(st)); }
    }
    return Array.from(byState.values());
  } catch (e) { log(`[income] live fetch failed: ${e.message}`); return []; }
}

async function main(){
  let rows = [];
  if (LIVE) rows = await fetchLive();
  if (!rows.length) {
    const IN = sourcesPath(DATE, 'income');
    const src = readJSON(IN);
    rows = Array.isArray(src) ? src : [];
    if (!rows.length) console.warn(`[income] No source at ${IN}`);
  }
  writeJSON(OUT, rows);
  console.log(`[income] Wrote ${rows.length} rows to ${OUT}`);
}

main().catch((e)=>{ console.error(e); process.exit(1); });

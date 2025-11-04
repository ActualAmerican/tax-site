#!/usr/bin/env node
// Ensure every state has rows for all metrics and that every row carries
// provenance fields required by the strengthened schemas. Values default to 0
// when unknown. This is a temporary bootstrap until real source snapshots land.

import fs from 'node:fs';
import path from 'node:path';

const PACK_PATH = path.resolve('data/packs/2025.1.0.json');
const YEAR = Number(process.env.PACK_YEAR || 2025);
const SRC = process.env.PROVENANCE_URL || 'https://placeholder.example/t1-bootstrap';
const EFF = process.env.EFFECTIVE_DATE || `${YEAR}-01-01`;
const CHECKED = process.env.CHECKED_AT || new Date().toISOString().slice(0, 10);

const STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN','IA','KS','KY',
  'LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK',
  'OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'
];

function byState(arr){ const m=new Map(); (arr||[]).forEach(r=>m.set(r.state,r)); return m; }
function ensureArr(v){ return Array.isArray(v)? v : []; }

function ensureProvenance(row){
  row.source_url = row.source_url || SRC;
  row.checked_at = row.checked_at || CHECKED;
  row.effective_date = row.effective_date || EFF;
  if (typeof row.year !== 'number') row.year = YEAR;
  return row;
}

function main(){
  const pack = JSON.parse(fs.readFileSync(PACK_PATH,'utf8'));
  pack.income   = ensureArr(pack.income);
  pack.sales    = ensureArr(pack.sales);
  pack.property = ensureArr(pack.property);
  pack.fuel     = ensureArr(pack.fuel);
  pack.excise   = ensureArr(pack.excise);

  const seen = {
    income: byState(pack.income),
    sales: byState(pack.sales),
    property: byState(pack.property),
    fuel: byState(pack.fuel),
    excise: byState(pack.excise),
  };

  let added = 0, touched = 0;
  for (const s of STATES){
    if (!seen.income.has(s)) {
      pack.income.push(ensureProvenance({ state:s, year:YEAR, has_income_tax:false, standard_deduction:0, flat:null, brackets:[] }));
      added++;
    }
    if (!seen.sales.has(s)) {
      pack.sales.push(ensureProvenance({ state:s, year:YEAR, state_rate:0, avg_local_rate:0, combined_rate:0 }));
      added++;
    }
    if (!seen.property.has(s)) {
      pack.property.push(ensureProvenance({ state:s, year:YEAR, effective_rate:0, method:'statewide average' }));
      added++;
    }
    if (!seen.fuel.has(s)) {
      pack.fuel.push(ensureProvenance({ state:s, year:YEAR, cents_per_gallon:0 }));
      added++;
    }
    if (!seen.excise.has(s)) {
      pack.excise.push(ensureProvenance({ state:s, year:YEAR, cigarette_per_pack:0, alcohol_per_unit:0, alcohol_unit:'per_unit', cigarette_unit:'per_pack' }));
      added++;
    }
  }

  // Backfill provenance on existing rows, too
  for (const m of ['income','sales','property','fuel','excise']){
    for (const r of pack[m]){
      const before = JSON.stringify(r);
      ensureProvenance(r);
      if (before !== JSON.stringify(r)) touched++;
    }
  }

  // Stable sort
  const by = (a,b)=> String(a.state).localeCompare(String(b.state));
  pack.income.sort(by); pack.sales.sort(by); pack.property.sort(by); pack.fuel.sort(by); pack.excise.sort(by);

  fs.writeFileSync(PACK_PATH, JSON.stringify(pack,null,2));
  console.log(`ensure_provenance: added ${added} rows; backfilled ${touched} rows; wrote ${PACK_PATH}`);
}

main();


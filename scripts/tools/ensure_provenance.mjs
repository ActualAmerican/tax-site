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
  pack.context  = ensureArr(pack.context);

  const seen = {
    income: byState(pack.income),
    sales: byState(pack.sales),
    property: byState(pack.property),
    fuel: byState(pack.fuel),
    excise: byState(pack.excise),
    context: byState(pack.context),
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
    if (!seen.context.has(s)) {
      pack.context.push(ensureProvenance({ state:s, year:YEAR, acs_median_income:0, bea_rpp:0, bls_unemp_rate:0 }));
      added++;
    }
  }

  // Backfill provenance on existing rows, too
  // Normalize and backfill provenance/fields on existing rows, too
  const normalize = {
    income(r){
      if (r.has_income_tax === false) return r;
      if (r.standard_deduction == null) r.standard_deduction = 0;
      if (r.flat == null && (!Array.isArray(r.brackets) || r.brackets.length === 0)) {
        // Leave as-is to avoid fabricating tax; UI handles missing gracefully.
        r.brackets = Array.isArray(r.brackets) ? r.brackets : [];
      }
      return r;
    },
    sales(r){
      const sr = Number(r.state_rate || 0);
      const lr = Number(r.avg_local_rate || 0);
      if (typeof r.combined_rate !== 'number') r.combined_rate = +(sr + lr);
      r.state_rate = sr; r.avg_local_rate = lr; return r;
    },
    property(r){ r.effective_rate = Number(r.effective_rate || 0); return r; },
    fuel(r){ r.cents_per_gallon = Number(r.cents_per_gallon || 0); return r; },
    excise(r){
      r.cigarette_per_pack = Number(r.cigarette_per_pack || 0);
      r.alcohol_per_unit = Number(r.alcohol_per_unit || 0);
      if (!r.cigarette_unit) r.cigarette_unit = 'per_pack';
      if (!r.alcohol_unit) r.alcohol_unit = 'per_unit';
      return r;
    },
    context(r){
      r.acs_median_income = Number(r.acs_median_income || 0);
      r.bea_rpp = Number(r.bea_rpp || 0);
      r.bls_unemp_rate = Number(r.bls_unemp_rate || 0);
      return r;
    }
  };

  for (const m of ['income','sales','property','fuel','excise','context']){
    for (const r of pack[m]){
      const before = JSON.stringify(r);
      normalize[m](ensureProvenance(r));
      if (before !== JSON.stringify(r)) touched++;
    }
  }

  // Stable sort
  const by = (a,b)=> String(a.state).localeCompare(String(b.state));
  pack.income.sort(by); pack.sales.sort(by); pack.property.sort(by); pack.fuel.sort(by); pack.excise.sort(by); pack.context.sort(by);

  fs.writeFileSync(PACK_PATH, JSON.stringify(pack,null,2));
  console.log(`ensure_provenance: added ${added} rows; backfilled ${touched} rows; wrote ${PACK_PATH}`);
}

main();

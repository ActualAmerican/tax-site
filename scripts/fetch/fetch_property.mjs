#!/usr/bin/env node
// Approximates statewide effective property tax rate from ACS.
import fs from 'node:fs';
import path from 'node:path';
import { today, httpGet, writeJSON, readJSON, sourcesPath, partialsPath, provenance } from './lib.mjs';

const LIVE = process.env.LIVE_SOURCES === '1';
const DATE = process.env.SOURCES_DATE || today();
const OUT = partialsPath('property');

const STATE_FIPS = {
  '01':'AL','02':'AK','04':'AZ','05':'AR','06':'CA','08':'CO','09':'CT','10':'DE','11':'DC','12':'FL','13':'GA','15':'HI','16':'ID','17':'IL','18':'IN','19':'IA','20':'KS','21':'KY','22':'LA','23':'ME','24':'MD','25':'MA','26':'MI','27':'MN','28':'MS','29':'MO','30':'MT','31':'NE','32':'NV','33':'NH','34':'NJ','35':'NM','36':'NY','37':'NC','38':'ND','39':'OH','40':'OK','41':'OR','42':'PA','44':'RI','45':'SC','46':'SD','47':'TN','48':'TX','49':'UT','50':'VT','51':'VA','53':'WA','54':'WV','55':'WI','56':'WY'
};

async function fetchLiveACS(){
  // Uses ACS 1-year Subject Table S2503 (Selected Housing Characteristics).
  // Median real estate taxes: S2503_C01_041E (median real estate taxes paid)
  // Median home value:       S2503_C01_001E (median value of owner-occupied)
  // Note: variable IDs may need tuning; kept isolated here for easy updates.
  const YEAR = process.env.ACS_YEAR || '2023';
  const key = process.env.CENSUS_API_KEY || '';
  const base = `https://api.census.gov/data/${YEAR}/acs/acs1/subject`;
  const vars = ['NAME','S2503_C01_041E','S2503_C01_001E'];
  const url = `${base}?get=${vars.join(',')}&for=state:*${key?`&key=${key}`:''}`;
  const json = await httpGet(url);
  if (!Array.isArray(json) || json.length < 2) return [];
  const head = json[0];
  const idxTaxes = head.indexOf('S2503_C01_041E');
  const idxValue = head.indexOf('S2503_C01_001E');
  const idxFips  = head.indexOf('state');
  const rows = [];
  for (let i=1;i<json.length;i++){
    const r = json[i];
    const fips = String(r[idxFips]).padStart(2,'0');
    const state = STATE_FIPS[fips];
    if (!state) continue;
    const medianTaxes = Number(r[idxTaxes] || 0);
    const medianValue = Number(r[idxValue] || 0);
    const eff = (medianValue > 0) ? (medianTaxes / medianValue) : 0;
    rows.push({ state, year: Number(YEAR), effective_rate: +eff.toFixed(4), method: 'ACS median taxes / median value', ...provenance(url, DATE, `${YEAR}-01-01`) });
  }
  return rows;
}

async function main(){
  let rows = [];
  if (LIVE) {
    try { rows = await fetchLiveACS(); } catch (e) { console.warn('[property] live ACS failed:', e.message); }
  }
  if (!rows.length) {
    const IN = sourcesPath(DATE, 'property');
    const src = readJSON(IN);
    rows = Array.isArray(src) ? src : [];
    if (!rows.length) console.warn(`[property] No source at ${IN}`);
  }
  writeJSON(OUT, rows);
  console.log(`[property] Wrote ${rows.length} rows to ${OUT}`);
}

main().catch((e)=>{ console.error(e); process.exit(1); });

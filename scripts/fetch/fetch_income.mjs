#!/usr/bin/env node
// Offline-friendly fetcher scaffold: reads data/sources/YYYY-MM-DD/income.json
// and writes normalized rows to data/partials/income.json
import fs from 'node:fs';
import path from 'node:path';

const DATE = process.env.SOURCES_DATE || new Date().toISOString().slice(0,10);
const IN = path.resolve(`data/sources/${DATE}/income.json`);
const OUT = path.resolve('data/partials/income.json');

function readJSON(p){ try { return JSON.parse(fs.readFileSync(p,'utf8')); } catch { return null; } }

const src = readJSON(IN);
if (!src) {
  console.warn(`[income] No source found at ${IN}. Skipping.`);
  process.exit(0);
}

// Expect an array of { state, has_income_tax, standard_deduction?, flat?, brackets? }
const rows = Array.isArray(src) ? src : [];
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(rows, null, 2));
console.log(`[income] Wrote ${rows.length} rows to ${OUT}`);


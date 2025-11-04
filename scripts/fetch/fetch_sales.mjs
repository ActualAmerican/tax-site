#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
const DATE = process.env.SOURCES_DATE || new Date().toISOString().slice(0,10);
const IN = path.resolve(`data/sources/${DATE}/sales.json`);
const OUT = path.resolve('data/partials/sales.json');
function readJSON(p){ try { return JSON.parse(fs.readFileSync(p,'utf8')); } catch { return null; } }
const src = readJSON(IN);
if (!src) { console.warn(`[sales] No source at ${IN}`); process.exit(0); }
const rows = Array.isArray(src) ? src : [];
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(rows, null, 2));
console.log(`[sales] Wrote ${rows.length} rows to ${OUT}`);


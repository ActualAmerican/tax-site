#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
const DATE = process.env.SOURCES_DATE || new Date().toISOString().slice(0,10);
const IN = path.resolve(`data/sources/${DATE}/fuel.json`);
const OUT = path.resolve('data/partials/fuel.json');
function readJSON(p){ try { return JSON.parse(fs.readFileSync(p,'utf8')); } catch { return null; } }
const src = readJSON(IN);
if (!src) { console.warn(`[fuel] No source at ${IN}`); process.exit(0); }
const rows = Array.isArray(src) ? src : [];
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(rows, null, 2));
console.log(`[fuel] Wrote ${rows.length} rows to ${OUT}`);


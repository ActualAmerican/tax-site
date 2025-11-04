#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
const DATE = process.env.SOURCES_DATE || new Date().toISOString().slice(0,10);
const IN = path.resolve(`data/sources/${DATE}/federal.json`);
const OUT = path.resolve('data/partials/federal.json');
function readJSON(p){ try { return JSON.parse(fs.readFileSync(p,'utf8')); } catch { return null; } }
const src = readJSON(IN);
if (!src) { console.warn(`[federal] No source at ${IN}`); process.exit(0); }
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(src, null, 2));
console.log(`[federal] Wrote federal object to ${OUT}`);


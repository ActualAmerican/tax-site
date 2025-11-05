#!/usr/bin/env node
// Federal params are updated annually; prefer local snapshot unless LIVE mode has a curated endpoint.
import { today, writeJSON, readJSON, sourcesPath, partialsPath } from './lib.mjs';

const DATE = process.env.SOURCES_DATE || today();
const OUT = partialsPath('federal');

const IN = sourcesPath(DATE, 'federal');
const src = readJSON(IN);
if (!src) { console.warn(`[federal] No source at ${IN}`); process.exit(0); }
writeJSON(OUT, src);
console.log(`[federal] Wrote federal object to ${OUT}`);

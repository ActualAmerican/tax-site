#!/usr/bin/env node
import fs from "fs";
import path from "path";
import crypto from "crypto";

const PACK_IN = path.resolve("data/packs/2025.1.0.json");
const OUT = path.resolve("data/packs/2025.1.0.composed.json");

function readJSON(p) {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch (e) {
    return null;
  }
}

const base = readJSON(PACK_IN) || {
  registry: {},
  income: [],
  sales: [],
  property: [],
  fuel: [],
  excise: [],
  federal: {},
  context: [],
};

// Merge any partials found in data/partials/<metric>.json (optional)
const METRICS = ["income", "sales", "property", "fuel", "excise", "context"];
for (const m of METRICS) {
  const partial = path.resolve(`data/partials/${m}.json`);
  const p = readJSON(partial);
  if (p && Array.isArray(p)) {
    // merge by state (overwrite base when present)
    const byState = new Map((base[m] || []).map((r) => [r.state, r]));
    for (const r of p) byState.set(r.state, r);
    base[m] = Array.from(byState.values());
    console.log(`Merged partial for ${m} (${p.length} rows)`);
  }
}

// attach built_at and compute hash
base.registry = base.registry || {};
base.registry.built_at = new Date().toISOString();
const payload = JSON.stringify(base, null, 2);
const hash =
  "sha256:" + crypto.createHash("sha256").update(payload).digest("hex");
base.registry.hash = hash;

fs.writeFileSync(OUT, JSON.stringify(base, null, 2));
console.log(`Wrote composed pack to ${OUT}`);
console.log(`hash: ${hash}`);

// Also emit a lightweight public/pack/latest.json for the app and monitoring
try {
  const pubDir = path.resolve('public/pack');
  fs.mkdirSync(pubDir, { recursive: true });
  const latest = {
    version: base.registry?.pack_version,
    built_at: base.registry?.built_at,
    hash: base.registry?.hash,
  };
  fs.writeFileSync(path.join(pubDir, 'latest.json'), JSON.stringify(latest, null, 2));
  console.log(`Updated ${path.join('public/pack','latest.json')}`);
} catch (e) {
  console.warn('Could not write public/pack/latest.json', e);
}

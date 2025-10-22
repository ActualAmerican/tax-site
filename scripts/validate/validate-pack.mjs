#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import Ajv2020 from "ajv/dist/2020.js"; // <-- 2020-12 aware
import addFormats from "ajv-formats";

const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);

const PACK = JSON.parse(fs.readFileSync("data/packs/2025.1.0.json", "utf8"));
const SCHEMA = (name) =>
  JSON.parse(fs.readFileSync(path.join("data/schemas", name), "utf8"));

const schemas = {
  registry: ajv.compile(SCHEMA("registry.json")),
  income: ajv.compile(SCHEMA("income.json")),
  sales: ajv.compile(SCHEMA("sales.json")),
  property: ajv.compile(SCHEMA("property.json")),
  fuel: ajv.compile(SCHEMA("fuel.json")),
  excise: ajv.compile(SCHEMA("excise.json")),
  federal: ajv.compile(SCHEMA("federal.json")),
  context: ajv.compile(SCHEMA("context.json")),
};

const die = (msg, err) => {
  console.error("❌", msg);
  if (err) console.error(err);
  process.exit(1);
};

if (!PACK.registry) die("Missing registry");
["income", "sales", "property", "fuel", "excise", "federal", "context"].forEach(
  (s) => {
    if (!PACK[s]) die(`Missing section: ${s}`);
  }
);

if (!schemas.registry(PACK.registry))
  die("Registry schema failed", schemas.registry.errors);
["income", "sales", "property", "fuel", "excise", "context"].forEach((key) => {
  for (const row of PACK[key])
    if (!schemas[key](row))
      die(`${key} schema failed for ${row.state || "??"}`, schemas[key].errors);
});
if (!schemas.federal(PACK.federal))
  die("Federal schema failed", schemas.federal.errors);

// sanity bounds
for (const r of PACK.sales) {
  const c = r.combined_rate ?? (r.state_rate || 0) + (r.avg_local_rate || 0);
  if (c < 0 || c > 0.15) die(`Unusual sales combined_rate ${c} for ${r.state}`);
}
for (const r of PACK.property) {
  if (r.effective_rate < 0 || r.effective_rate > 0.04)
    die(`Unusual property rate ${r.effective_rate} for ${r.state}`);
}
for (const r of PACK.fuel) {
  if (r.cents_per_gallon < 0 || r.cents_per_gallon > 1000)
    die(`Unusual fuel cents/gal ${r.cents_per_gallon} for ${r.state}`);
}

console.log("✅ Pack 2025.1.0 passed schema & sanity checks.");

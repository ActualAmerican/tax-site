#!/usr/bin/env node
import fs from "fs";
import path from "path";

const PACK = path.resolve("data/packs/2025.1.0.json");
const pack = JSON.parse(fs.readFileSync(PACK, "utf8"));

const STATES = [
  "AL",
  "AK",
  "AZ",
  "AR",
  "CA",
  "CO",
  "CT",
  "DE",
  "DC",
  "FL",
  "GA",
  "HI",
  "ID",
  "IL",
  "IN",
  "IA",
  "KS",
  "KY",
  "LA",
  "ME",
  "MD",
  "MA",
  "MI",
  "MN",
  "MS",
  "MO",
  "MT",
  "NE",
  "NV",
  "NH",
  "NJ",
  "NM",
  "NY",
  "NC",
  "ND",
  "OH",
  "OK",
  "OR",
  "PA",
  "RI",
  "SC",
  "SD",
  "TN",
  "TX",
  "UT",
  "VT",
  "VA",
  "WA",
  "WV",
  "WI",
  "WY",
];
const METRICS = ["income", "sales", "property", "fuel", "excise", "context"];

function indexByMetric(m) {
  const by = new Map();
  for (const metric of METRICS) by.set(metric, new Map());
  for (const metric of METRICS) {
    const arr = pack[metric] || [];
    for (const row of arr) {
      if (row && row.state) by.get(metric).set(row.state.toUpperCase(), row);
    }
  }
  return by;
}

const by = indexByMetric();

const missing = {};
for (const metric of METRICS) missing[metric] = [];

for (const s of STATES) {
  for (const metric of METRICS) {
    if (!by.get(metric).has(s)) missing[metric].push(s);
  }
}

console.log("Pack audit for", pack.registry?.pack_version || "(unknown)");
for (const metric of METRICS) {
  const arr = missing[metric];
  console.log(`- ${metric}: ${arr.length} missing`);
  if (arr.length <= 10) console.log("  ", arr.join(", "));
}

console.log("\nHelpful next steps:");
console.log(
  "- Update scripts/fetch/ to include sources for metrics with many missing states"
);
console.log(
  "- Use scripts/build_pack.mjs to re-run composition and then scripts/validate/validate-pack.mjs"
);
console.log("- Consider caching last-green pack as deployment artifact");

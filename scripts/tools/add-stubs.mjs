// scripts/tools/add-stubs.mjs
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const PACK_PATH = path.join(ROOT, "data", "packs", "2025.1.0.json");

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

function byState(arr) {
  const map = new Map();
  (arr || []).forEach((r) => map.set(r.state, r));
  return map;
}
function ensure(arr) {
  return Array.isArray(arr) ? arr : [];
}

function main() {
  const src = JSON.parse(fs.readFileSync(PACK_PATH, "utf8"));

  src.income = ensure(src.income);
  src.sales = ensure(src.sales);
  src.property = ensure(src.property);
  src.fuel = ensure(src.fuel);
  src.excise = ensure(src.excise);
  src.context = src.context || {}; // leave context to real fetchers later

  const seen = {
    income: byState(src.income),
    sales: byState(src.sales),
    property: byState(src.property),
    fuel: byState(src.fuel),
    excise: byState(src.excise),
  };

  let added = 0;
  for (const s of STATES) {
    if (!seen.income.has(s)) {
      src.income.push({
        state: s,
        has_income_tax: false,
        standard_deduction: 0,
        brackets: [],
      });
      added++;
    }
    if (!seen.sales.has(s)) {
      src.sales.push({
        state: s,
        state_rate: 0,
        avg_local_rate: 0,
        combined_rate: 0,
      });
      added++;
    }
    if (!seen.property.has(s)) {
      src.property.push({ state: s, effective_rate: 0 });
      added++;
    }
    if (!seen.fuel.has(s)) {
      src.fuel.push({ state: s, cents_per_gallon: 0 });
      added++;
    }
    if (!seen.excise.has(s)) {
      src.excise.push({ state: s, cigarette_per_pack: 0, alcohol_per_unit: 0 });
      added++;
    }
  }

  // stable sorting
  const sortByState = (a, b) => a.state.localeCompare(b.state);
  src.income.sort(sortByState);
  src.sales.sort(sortByState);
  src.property.sort(sortByState);
  src.fuel.sort(sortByState);
  src.excise.sort(sortByState);

  fs.writeFileSync(PACK_PATH, JSON.stringify(src, null, 2));
  console.log(
    `✅ Added/ensured stubs. Rows added: ${added}. Saved ${PACK_PATH}`
  );
}

main();

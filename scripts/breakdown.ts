// src/scripts/breakdown.ts
// Client-side breakdown renderer that fetches the pack once.

type Inputs = {
  filingStatus: "single" | "married";
  income: number;
  homeowner: boolean;
  homeValue: number;
  miles: number;
  mpg: number;
  spendingShare: number;
  taxableShare: number;
  cigPacksPerWeek: number;
  alcoholUnitsPerWeek: number;
  includeFederal: boolean;
  ltcg: number;
};

type Instance = {
  el: HTMLElement;
  slot: "solo" | "left" | "right";
  state: string;
  inputs: Inputs;
  els: {
    chart: HTMLElement;
    tbody: HTMLElement;
    tot: HTMLElement;
    eff: HTMLElement;
    stateLabel: HTMLElement;
    exportLink: HTMLAnchorElement;
  };
};

const fmt$ = new Intl.NumberFormat(undefined, {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});
const fmtP = (x: number) => (x * 100).toFixed(1) + "%";

const INST: Instance[] = [];
let PACK: any | null = null;

async function ensurePack() {
  if (PACK) return PACK;
  const res = await fetch("/data/pack.json", { cache: "no-cache" });
  PACK = await res.json();
  return PACK;
}

const get = (row: any, k: string, def = 0) => (row && k in row ? row[k] : def);

function calcStateIncomeTax(pack: any, s: string, gross: number) {
  const row = pack.income.find((r: any) => r.state === s);
  if (!row || !row.has_income_tax) return 0;
  const std = row.standard_deduction ?? 0;
  const taxable = Math.max(0, gross - std);
  if (row.flat != null) return taxable * row.flat;
  let tax = 0,
    prev = 0;
  for (const b of row.brackets || []) {
    const cap = b.up_to ?? taxable;
    const slice = Math.max(0, Math.min(taxable, cap) - prev);
    tax += slice * b.rate;
    prev = cap;
    if (prev >= taxable) break;
  }
  return tax;
}
function calcSales(pack: any, s: string, i: Inputs) {
  const row = pack.sales.find((r: any) => r.state === s);
  const combined = get(
    row,
    "combined_rate",
    get(row, "state_rate", 0) + get(row, "avg_local_rate", 0)
  );
  const spend = i.income * i.spendingShare * i.taxableShare;
  return spend * combined;
}
function calcProperty(pack: any, s: string, i: Inputs) {
  if (!i.homeowner) return 0;
  const row = pack.property.find((r: any) => r.state === s);
  return i.homeValue * get(row, "effective_rate", 0);
}
function calcFuel(pack: any, s: string, i: Inputs) {
  const row = pack.fuel.find((r: any) => r.state === s);
  const gallons = (i.miles || 0) / Math.max(1, i.mpg || 1);
  return gallons * get(row, "cents_per_gallon", 0);
}
function calcExcise(pack: any, s: string, i: Inputs) {
  const row = pack.excise.find((r: any) => r.state === s);
  const c = (i.cigPacksPerWeek || 0) * 52 * get(row, "cigarette_per_pack", 0);
  const a =
    (i.alcoholUnitsPerWeek || 0) *
    52 *
    (get(row, "alcohol_per_unit", 0) || get(row, "beer_per_gal", 0));
  return c + a;
}
function calcFederal(pack: any, i: Inputs) {
  const fed = pack.federal;
  const fs = i.filingStatus;
  const std = fed.irs.std_deduction[fs];
  const taxable = Math.max(0, i.income - std);
  let inc = 0,
    prev = 0;
  for (const b of fed.irs.brackets[fs]) {
    const cap = b.up_to ?? taxable;
    const slice = Math.max(0, Math.min(taxable, cap) - prev);
    inc += slice * b.rate;
    prev = cap;
    if (prev >= taxable) break;
  }
  const wb = fed.ssa.wage_base;
  const payroll =
    Math.min(i.income, wb) * 0.062 +
    i.income * fed.medicare.rate +
    Math.max(0, i.income - fed.medicare.surtax_threshold[fs]) * 0.009;

  const [z, t1, t2] = fed.irs.ltcg_thresholds[fs];
  const a = Math.max(0, i.ltcg || 0);
  const b1 = Math.max(0, Math.min(a, t1));
  const b2 = Math.max(0, Math.min(a - b1, t2 - t1));
  const b3 = Math.max(0, a - b1 - b2);
  return { income: inc, payroll, ltcg: b1 * 0 + b2 * 0.15 + b3 * 0.2 };
}

function compute(inst: Instance) {
  if (!PACK) return; // guard until loaded
  const i = inst.inputs;
  const s = inst.state;

  const rows: [string, number][] = [
    ["Income (state)", calcStateIncomeTax(PACK, s, i.income)],
    ["Sales", calcSales(PACK, s, i)],
    ["Property", calcProperty(PACK, s, i)],
    ["Fuel", calcFuel(PACK, s, i)],
    ["Excise", calcExcise(PACK, s, i)],
  ];
  if (i.includeFederal) {
    const f = calcFederal(PACK, i);
    rows.push(["Federal income", f.income]);
    rows.push(["Payroll (FICA/Medicare)", f.payroll]);
    if (i.ltcg > 0) rows.push(["LTCG", f.ltcg]);
  }
  const total = rows.reduce((a, [, v]) => a + v, 0);
  const eff = total / Math.max(1, i.income);

  const { chart, tbody, tot, eff: effEl } = inst.els;
  tbody.innerHTML = "";
  for (const [k, v] of rows) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${k}</td><td style="text-align:right">${fmt$.format(
      v
    )}</td><td style="text-align:right">${fmtP(v / (i.income || 1))}</td>`;
    tbody.appendChild(tr);
  }
  tot.textContent = fmt$.format(total);
  effEl.textContent = fmtP(eff);

  chart.innerHTML = "";
  rows.forEach(([k, v], idx) => {
    const seg = document.createElement("section");
    seg.title = `${k}: ${fmt$.format(v)} (${fmtP(v / (i.income || 1))})`;
    seg.style.width = (v / Math.max(1, total)) * 100 + "%";
    seg.style.background = [
      "#22c55e",
      "#eab308",
      "#0ea5e9",
      "#a78bfa",
      "#f97316",
      "#64748b",
      "#0891b2",
      "#ef4444",
    ][idx % 8];
    chart.appendChild(seg);
  });

  // update export link
  const p = new URLSearchParams({
    state: inst.state,
    fs: i.filingStatus,
    inc: String(i.income),
    ho: i.homeowner ? "1" : "0",
    hv: String(i.homeValue),
    mi: String(i.miles),
    mpg: String(i.mpg),
    ss: String(i.spendingShare),
    ts: String(i.taxableShare),
    cig: String(i.cigPacksPerWeek),
    alc: String(i.alcoholUnitsPerWeek),
    fed: i.includeFederal ? "1" : "0",
    ltcg: String(i.ltcg || 0),
  });
  inst.els.exportLink.href = "/report?" + p.toString();
}

function init(el: HTMLElement): Instance {
  const slot = (el.getAttribute("data-slot") || "solo") as Instance["slot"];
  const state = (el.getAttribute("data-state") || "CA").toUpperCase();
  const inst: Instance = {
    el,
    slot,
    state,
    inputs: {
      filingStatus: "single",
      income: 60000,
      homeowner: true,
      homeValue: 300000,
      miles: 12000,
      mpg: 28,
      spendingShare: 0.6,
      taxableShare: 0.55,
      cigPacksPerWeek: 0,
      alcoholUnitsPerWeek: 0,
      includeFederal: false,
      ltcg: 0,
    },
    els: {
      chart: el.querySelector("#chart") as HTMLElement,
      tbody: el.querySelector("tbody") as HTMLElement,
      tot: el.querySelector("#tot") as HTMLElement,
      eff: el.querySelector("#eff") as HTMLElement,
      stateLabel: el.querySelector("#bd-state") as HTMLElement,
      exportLink: el.querySelector("#export") as HTMLAnchorElement,
    },
  };
  inst.els.stateLabel.textContent = inst.state;
  return inst;
}

// boot all panels after DOM is ready
function boot() {
  document
    .querySelectorAll<HTMLElement>("[data-t1-breakdown]")
    .forEach((el) => {
      INST.push(init(el));
    });
  // Load the pack then compute everything
  ensurePack().then(() => {
    INST.forEach(compute);
  });
}

// respond to inputs/state changes
window.addEventListener("t1:inputs", (e: any) => {
  const d = e.detail || {};
  for (const inst of INST) {
    Object.assign(inst.inputs, d);
    if (PACK) compute(inst);
  }
});
function stateUpdate(targetSlot: Instance["slot"], code: string) {
  for (const inst of INST) {
    if (inst.slot === targetSlot) {
      inst.state = (code || "CA").toUpperCase();
      inst.els.stateLabel.textContent = inst.state;
      if (PACK) compute(inst);
    }
  }
}
window.addEventListener("t1:state-solo", (e: any) =>
  stateUpdate("solo", e.detail)
);
window.addEventListener("t1:state-left", (e: any) =>
  stateUpdate("left", e.detail)
);
window.addEventListener("t1:state-right", (e: any) =>
  stateUpdate("right", e.detail)
);
// backward compat
window.addEventListener("t1:state", (e: any) => stateUpdate("solo", e.detail));

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}

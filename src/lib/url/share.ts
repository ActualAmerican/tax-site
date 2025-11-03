// src/lib/url/share.ts
// Centralized helpers for compact tax params in the query string.

export type Inputs = {
  filingStatus: string;
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

export const COMPACT_KEYS = {
  fs: "filingStatus",
  inc: "income",
  ho: "homeowner",
  hv: "homeValue",
  mi: "miles",
  mpg: "mpg",
  ss: "spendingShare",
  ts: "taxableShare",
  cig: "cigPacksPerWeek",
  alc: "alcoholUnitsPerWeek",
  fed: "includeFederal",
  ltcg: "ltcg",
} as const;

export function currentURL(): URL {
  return new URL(window.location.href);
}

export function parseNum(v: unknown): number {
  if (v == null) return 0;
  const n = Number(String(v).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

export function readInputsFromURL(u: URL): Inputs {
  const gp = (k: keyof typeof COMPACT_KEYS) => u.searchParams.get(k);
  return {
    filingStatus: gp("fs") || "single",
    income: gp("inc") ? parseNum(gp("inc")) : 60000,
    homeowner: (gp("ho") ?? "1") === "1",
    homeValue: gp("hv") ? parseNum(gp("hv")) : 300000,
    miles: gp("mi") ? +gp("mi")! : 12000,
    mpg: gp("mpg") ? +gp("mpg")! : 28,
    spendingShare: gp("ss") ? +gp("ss")! : 0.6,
    taxableShare: gp("ts") ? +gp("ts")! : 0.55,
    cigPacksPerWeek: gp("cig") ? +gp("cig")! : 0,
    alcoholUnitsPerWeek: gp("alc") ? +gp("alc")! : 0,
    includeFederal: (gp("fed") ?? "0") === "1",
    ltcg: gp("ltcg") ? parseNum(gp("ltcg")) : 0,
  };
}

export function writeInputsToURL(u: URL, i: Inputs): URL {
  const sp = u.searchParams;
  const set = (k: string, v: string | number | null | undefined) => {
    if (v === null || v === undefined || v === "" || v === 0) sp.delete(k);
    else sp.set(k, String(v));
  };
  set("fs", i.filingStatus);
  set("inc", i.income | 0);
  set("ho", i.homeowner ? "1" : "0");
  set("hv", i.homeValue | 0);
  set("mi", i.miles);
  set("mpg", i.mpg);
  set("ss", i.spendingShare);
  set("ts", i.taxableShare);
  set("cig", i.cigPacksPerWeek || null);
  set("alc", i.alcoholUnitsPerWeek || null);
  set("fed", i.includeFederal ? "1" : "0");
  set("ltcg", i.ltcg || null);
  return u;
}

export function buildCompareURL(a: string, b: string, base?: URL): URL {
  const u = base ? new URL(base.href) : currentURL();
  u.searchParams.set("a", a.toUpperCase());
  u.searchParams.set("b", b.toUpperCase());
  return u;
}

export function linkToMainWithInputs(fips: string, base?: URL): URL {
  const u = base ? new URL(base.href) : currentURL();
  u.pathname = "/";
  u.searchParams.set("fips", fips.toUpperCase());
  u.searchParams.delete("a");
  u.searchParams.delete("b");
  return u;
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

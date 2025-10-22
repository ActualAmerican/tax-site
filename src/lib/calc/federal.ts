export function calc(
  pack: any,
  filingStatus: "single" | "married",
  gross: number,
  ltcg: number
) {
  const fed = pack.federal;
  // income tax
  const std = fed.irs.std_deduction[filingStatus];
  const taxable = Math.max(0, gross - std);
  const brackets = fed.irs.brackets[filingStatus] as {
    up_to: number | null;
    rate: number;
  }[];
  let income = 0,
    prev = 0;
  for (const b of brackets) {
    const cap = b.up_to ?? taxable;
    const slice = Math.max(0, Math.min(taxable, cap) - prev);
    income += slice * b.rate;
    prev = cap;
    if (prev >= taxable) break;
  }
  // payroll
  const wageBase = fed.ssa.wage_base;
  const payroll =
    Math.min(gross, wageBase) * 0.062 +
    gross * fed.medicare.rate +
    Math.max(0, gross - fed.medicare.surtax_threshold[filingStatus]) * 0.009;
  // ltcg
  const [z, th1, th2] = fed.irs.ltcg_thresholds[filingStatus];
  const ltcgTax = (amt: number) => {
    let t = 0;
    const a = Math.max(0, amt);
    const band1 = Math.max(0, Math.min(a, th1));
    const band2 = Math.max(0, Math.min(a - band1, th2 - th1));
    const band3 = Math.max(0, a - band1 - band2);
    t += band1 * 0 + band2 * 0.15 + band3 * 0.2;
    return t;
  };
  return { income, payroll, ltcg: ltcgTax(ltcg) };
}

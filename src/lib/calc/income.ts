type Bracket = { up_to: number | null; rate: number };
export function calc(pack: any, state: string, gross: number) {
  const row = pack.income.find((r: any) => r.state === state);
  if (!row || !row.has_income_tax) return 0;
  const std = row.standard_deduction ?? 0;
  const taxable = Math.max(0, gross - std);
  if (row.flat != null) return taxable * row.flat;
  const brackets: Bracket[] = row.brackets || [];
  let tax = 0,
    prev = 0;
  for (const b of brackets) {
    const cap = b.up_to ?? taxable;
    const slice = Math.max(0, Math.min(taxable, cap) - prev);
    tax += slice * b.rate;
    prev = cap;
    if (prev >= taxable) break;
  }
  return tax;
}

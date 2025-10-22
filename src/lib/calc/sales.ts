export function calc(
  pack: any,
  state: string,
  income: number,
  spendingShare: number,
  taxableShare: number
) {
  const row = pack.sales.find((r: any) => r.state === state);
  if (!row) return 0;
  const combined =
    row.combined_rate ?? (row.state_rate || 0) + (row.avg_local_rate || 0);
  const spend = income * spendingShare * taxableShare;
  return spend * combined;
}

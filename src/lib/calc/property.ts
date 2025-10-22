export function calc(pack: any, state: string, homeValue: number) {
  const row = pack.property.find((r: any) => r.state === state);
  if (!row) return 0;
  const eff = row.effective_rate || 0;
  return homeValue * eff;
}

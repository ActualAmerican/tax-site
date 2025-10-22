export function calc(pack: any, state: string, miles: number, mpg: number) {
  const row = pack.fuel.find((r: any) => r.state === state);
  if (!row) return 0;
  const gallons = (miles || 0) / Math.max(1, mpg || 1);
  return gallons * (row.cents_per_gallon || 0);
}

export function calc(pack: any, state: string, miles: number, mpg: number) {
  const row = pack.fuel.find((r: any) => r.state === state);
  if (!row) return 0;
  const gallons = (miles || 0) / Math.max(1, mpg || 1);
  // pack stores cents per gallon (e.g. 66 = $0.66). Convert to dollars here.
  return (gallons * (row.cents_per_gallon || 0)) / 100;
}

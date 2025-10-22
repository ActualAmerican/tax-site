export function calc(
  pack: any,
  state: string,
  cigPacksPerWeek: number,
  alcoholUnitsPerWeek: number
) {
  const row = pack.excise.find((r: any) => r.state === state);
  if (!row) return 0;
  const c = (cigPacksPerWeek || 0) * 52 * (row.cigarette_per_pack || 0);
  const a =
    (alcoholUnitsPerWeek || 0) *
    52 *
    (row.alcohol_per_unit || row.beer_per_gal || 0);
  return c + a;
}

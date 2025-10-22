export const formatCurrency = (n: number) =>
  new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
export const formatPercent = (n: number) => (n * 100).toFixed(1) + "%";

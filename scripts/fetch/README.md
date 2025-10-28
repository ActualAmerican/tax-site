This folder should contain fetchers that gather metrics from authoritative sources and emit per-metric JSON files into `data/partials/<metric>.json`.

Planned layout:

- scripts/fetch/fetch_income.mjs
- scripts/fetch/fetch_sales.mjs
- scripts/fetch/fetch_fuel.mjs

Each fetcher should:

- read configuration/mapping of sources (e.g. `scripts/fetch/sources.json`)
- fetch remotely, normalize values to the project's schema, and write to `data/partials/<metric>.json`.

Current status: no fetchers implemented. Use `scripts/audit_pack.mjs` to see which states are missing and then implement a fetcher for each metric.

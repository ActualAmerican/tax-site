const DEFAULT_LOCAL_SCOPE = Object.freeze({
  enabled: false,
  zip: null,
  city: null,
  countyName: null,
  countyFips: null,
  fipsCounty: null,
  state: null,
  stateFips: null,
  source: null,
  toggles: 0,
});

const cleanString = (value: unknown) => {
  if (value == null) return null;
  const str = String(value).trim();
  return str ? str : null;
};

const digitsOnly = (value: unknown) => {
  if (value == null) return null;
  const digits = String(value).trim().replace(/\D+/g, '');
  return digits || null;
};

const normalizeZip = (value: unknown) => {
  const digits = digitsOnly(value);
  if (!digits) return null;
  if (digits.length >= 5) return digits.slice(0, 5);
  return digits.padStart(5, '0');
};

const normalizeStateFips = (value: unknown) => {
  const digits = digitsOnly(value);
  if (!digits) return null;
  const normalized = digits.slice(0, 2).padStart(2, '0');
  return normalized === '00' ? null : normalized;
};

const normalizeCountyFips = (value: unknown) => {
  const digits = digitsOnly(value);
  if (!digits) return null;
  return digits.slice(0, 5).padStart(5, '0');
};

const clampToggle = (value: unknown, fallback = 0) => {
  const candidate = Number.isFinite(value) ? (value as number) : fallback;
  if (!Number.isFinite(candidate)) return 0;
  return Math.max(0, Math.trunc(candidate));
};

export function normalizeLocalScope(source: Record<string, unknown> = {}, options: Record<string, unknown> = {}) {
  const fallbackState = (options.fallbackState as Record<string, unknown>) || {};
  const next = { ...DEFAULT_LOCAL_SCOPE };

  next.enabled =
    typeof source.enabled === 'boolean'
      ? source.enabled
      : typeof options.enabled === 'boolean'
        ? (options.enabled as boolean)
        : DEFAULT_LOCAL_SCOPE.enabled;

  const fallbackStateCode = cleanString(fallbackState.code ?? fallbackState.state);
  const fallbackStateFips = normalizeStateFips(fallbackState.fips ?? fallbackState.stateFips);

  next.state = cleanString(source.state ?? fallbackStateCode);
  next.stateFips = normalizeStateFips(source.stateFips ?? fallbackStateFips);

  const county = normalizeCountyFips(source.countyFips ?? source.fipsCounty);
  next.countyFips = county;
  next.fipsCounty = county;

  next.countyName = cleanString(source.countyName);
  next.city = cleanString(source.city);
  next.zip = normalizeZip(source.zip);
  next.source = cleanString(source.source);

  const togglesCandidate =
    typeof source.toggles === 'number' ? source.toggles : (options.defaultToggles as number | undefined);
  next.toggles = clampToggle(togglesCandidate);

  return next;
}

export { DEFAULT_LOCAL_SCOPE };

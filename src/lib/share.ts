export type FilingStatus = 'single' | 'married' | 'hoh';

export interface ShareInputs {
  filingStatus: FilingStatus;
  income: number;
  homeowner: boolean;
  homeValue: number;
  miles: number;
  mpg: number;
  spendingShare: number;
  taxableShare: number;
  includeFederal: boolean;
  ltcg: number;
  cigPacksPerWeek: number;
  alcoholUnitsPerWeek: number;
}

export interface ShareScope {
  local: boolean;
  state: boolean;
  federal: boolean;
}

export interface ShareLocal {
  zip: string | null;
  countyFips: string | null;
  toggles: number;
}

export interface ShareModel {
  state: {
    fips: string | null;
    code: string | null;
  };
  inputs: ShareInputs;
  scope: ShareScope;
  local: ShareLocal;
  version: string | null;
}

export interface ShareModelPatch {
  state?: Partial<ShareModel['state']>;
  inputs?: Partial<ShareInputs>;
  scope?: Partial<ShareScope>;
  local?: Partial<ShareLocal>;
  version?: string | null;
}

export interface DecodeOptions {
  packVersion?: string;
}

export interface EncodeOptions {
  baseUrl?: string | URL;
  packVersion?: string;
}

export const STATE_CODE_TO_FIPS = {
  AL: '01',
  AK: '02',
  AZ: '04',
  AR: '05',
  CA: '06',
  CO: '08',
  CT: '09',
  DE: '10',
  DC: '11',
  FL: '12',
  GA: '13',
  HI: '15',
  ID: '16',
  IL: '17',
  IN: '18',
  IA: '19',
  KS: '20',
  KY: '21',
  LA: '22',
  ME: '23',
  MD: '24',
  MA: '25',
  MI: '26',
  MN: '27',
  MS: '28',
  MO: '29',
  MT: '30',
  NE: '31',
  NV: '32',
  NH: '33',
  NJ: '34',
  NM: '35',
  NY: '36',
  NC: '37',
  ND: '38',
  OH: '39',
  OK: '40',
  OR: '41',
  PA: '42',
  RI: '44',
  SC: '45',
  SD: '46',
  TN: '47',
  TX: '48',
  UT: '49',
  VT: '50',
  VA: '51',
  WA: '53',
  WV: '54',
  WI: '55',
  WY: '56',
  PR: '72',
} as const;

export type StateCode = keyof typeof STATE_CODE_TO_FIPS;

export const FIPS_TO_STATE_CODE: Record<string, StateCode> = Object.fromEntries(
  Object.entries(STATE_CODE_TO_FIPS).map(([code, fips]) => [fips, code]),
) as Record<string, StateCode>;

export const CANONICAL_KEYS = [
  'fips',
  'fs',
  'inc',
  'own',
  'home',
  'miles',
  'mpg',
  'sp',
  'tx',
  'fed',
  'ltcg',
  'sc',
  'zip',
  'cty',
  'lc',
  'ver',
] as const;

const STATUS_TO_CODE: Record<FilingStatus, number> = {
  single: 0,
  married: 1,
  hoh: 2,
};

const CODE_TO_STATUS: { [key: number]: FilingStatus } = {
  0: 'single',
  1: 'married',
  2: 'hoh',
};

const STATUS_ALIASES: Record<string, FilingStatus> = {
  single: 'single',
  s: 'single',
  '0': 'single',
  married: 'married',
  m: 'married',
  '1': 'married',
  hoh: 'hoh',
  'head-of-household': 'hoh',
  head: 'hoh',
  household: 'hoh',
  '2': 'hoh',
};

const SCOPE_BITS = {
  local: 1,
  state: 2,
  federal: 4,
} as const;

const DEFAULT_INPUTS: ShareInputs = {
  filingStatus: 'single',
  income: 60000,
  homeowner: true,
  homeValue: 300000,
  miles: 12000,
  mpg: 28,
  spendingShare: 0.6,
  taxableShare: 0.55,
  includeFederal: true,
  ltcg: 0,
  cigPacksPerWeek: 0,
  alcoholUnitsPerWeek: 0,
};

const DEFAULT_SCOPE: ShareScope = {
  local: false,
  state: true,
  federal: true,
};

const DEFAULT_LOCAL: ShareLocal = {
  zip: null,
  countyFips: null,
  toggles: 0,
};

const FALLBACK_BASE_URL = 'https://example.com/';

export function createDefaultModel(opts: DecodeOptions = {}): ShareModel {
  return {
    state: { fips: null, code: null },
    inputs: { ...DEFAULT_INPUTS },
    scope: { ...DEFAULT_SCOPE },
    local: { ...DEFAULT_LOCAL },
    version: opts.packVersion ?? null,
  };
}

export function filingStatusToCode(status: FilingStatus): number {
  return STATUS_TO_CODE[status] ?? 0;
}

export function codeToFilingStatus(code: unknown, fallback: FilingStatus = 'single'): FilingStatus {
  if (typeof code === 'string') {
    const key = code.trim().toLowerCase();
    if (STATUS_ALIASES[key]) return STATUS_ALIASES[key];
    const parsed = Number(key);
    if (Number.isFinite(parsed) && CODE_TO_STATUS[parsed]) return CODE_TO_STATUS[parsed];
  }
  if (typeof code === 'number' && Number.isFinite(code) && CODE_TO_STATUS[Math.trunc(code)]) {
    return CODE_TO_STATUS[Math.trunc(code)];
  }
  return fallback;
}

export function scopeToMask(scope: ShareScope): number {
  let mask = 0;
  if (scope.local) mask |= SCOPE_BITS.local;
  if (scope.state) mask |= SCOPE_BITS.state;
  if (scope.federal) mask |= SCOPE_BITS.federal;
  return mask;
}

export function maskToScope(mask: unknown, fallback?: ShareScope): ShareScope {
  const base = fallback ? { ...fallback } : { ...DEFAULT_SCOPE };
  if (mask == null || mask === '') return base;
  const normalized = typeof mask === 'string' ? Number(mask.replace(/[^0-9]/g, '')) : Number(mask);
  if (!Number.isFinite(normalized)) return base;
  return {
    local: (normalized & SCOPE_BITS.local) === SCOPE_BITS.local,
    state: (normalized & SCOPE_BITS.state) === SCOPE_BITS.state,
    federal: (normalized & SCOPE_BITS.federal) === SCOPE_BITS.federal,
  };
}

export function sanitizeModel(model: ShareModel | ShareModelPatch | undefined, opts: DecodeOptions = {}): ShareModel {
  const defaults = createDefaultModel(opts);
  if (!model) return defaults;

  const stateSource = model.state ?? {};
  const stateFips = normalizeStateFips(stateSource.fips ?? null) ?? defaults.state.fips;
  let stateCode = normalizeStateCode(stateSource.code ?? null) ?? defaults.state.code;
  if (!stateCode && stateFips) {
    stateCode = FIPS_TO_STATE_CODE[stateFips] ?? null;
  }

  const inputsSource = model.inputs ?? {};
  const inputs: ShareInputs = {
    filingStatus: sanitizeFilingStatus(inputsSource.filingStatus ?? defaults.inputs.filingStatus),
    income: sanitizeMoney(inputsSource.income ?? defaults.inputs.income, defaults.inputs.income),
    homeowner: toBoolean(inputsSource.homeowner ?? defaults.inputs.homeowner, defaults.inputs.homeowner),
    homeValue: sanitizeMoney(inputsSource.homeValue ?? defaults.inputs.homeValue, defaults.inputs.homeValue),
    miles: sanitizeInt(inputsSource.miles ?? defaults.inputs.miles, defaults.inputs.miles),
    mpg: sanitizeInt(inputsSource.mpg ?? defaults.inputs.mpg, defaults.inputs.mpg, 1),
    spendingShare: sanitizeShare(inputsSource.spendingShare ?? defaults.inputs.spendingShare, defaults.inputs.spendingShare),
    taxableShare: sanitizeShare(inputsSource.taxableShare ?? defaults.inputs.taxableShare, defaults.inputs.taxableShare),
    includeFederal: toBoolean(inputsSource.includeFederal ?? defaults.inputs.includeFederal, defaults.inputs.includeFederal),
    ltcg: sanitizeMoney(inputsSource.ltcg ?? defaults.inputs.ltcg, defaults.inputs.ltcg),
    cigPacksPerWeek: sanitizeDecimal(
      inputsSource.cigPacksPerWeek ?? defaults.inputs.cigPacksPerWeek,
      defaults.inputs.cigPacksPerWeek,
      0,
      undefined,
      2,
    ),
    alcoholUnitsPerWeek: sanitizeDecimal(
      inputsSource.alcoholUnitsPerWeek ?? defaults.inputs.alcoholUnitsPerWeek,
      defaults.inputs.alcoholUnitsPerWeek,
      0,
      undefined,
      2,
    ),
  };

  const scopeSource = model.scope ?? {};
  const scope: ShareScope = {
    local: toBoolean(scopeSource.local ?? defaults.scope.local, defaults.scope.local),
    state: toBoolean(scopeSource.state ?? defaults.scope.state, defaults.scope.state),
    federal: toBoolean(scopeSource.federal ?? defaults.scope.federal, defaults.scope.federal),
  };

  const localSource = model.local ?? {};
  const localZipCandidate = (localSource as Record<string, unknown>).postalCode ?? localSource.zip ?? null;
  const countyCandidate =
    localSource.countyFips ??
    (localSource as Record<string, unknown>).fipsCounty ??
    (localSource as Record<string, unknown>).county ??
    (localSource as Record<string, unknown>).fips ??
    null;
  const togglesCandidate =
    localSource.toggles ??
    (localSource as Record<string, unknown>).mask ??
    (localSource as Record<string, unknown>).bitmask ??
    defaults.local.toggles;
  const local: ShareLocal = {
    zip: normalizeZip(localZipCandidate),
    countyFips: normalizeCountyFips(countyCandidate),
    toggles: sanitizeInt(togglesCandidate, defaults.local.toggles, 0),
  };

  let version = defaults.version;
  if ('version' in (model as Record<string, unknown>)) {
    const raw = (model as Record<string, unknown>).version;
    if (typeof raw === 'string' && raw.trim()) {
      version = raw.trim();
    } else if (raw === null) {
      version = null;
    }
  }

  return {
    state: { fips: stateFips, code: stateCode },
    inputs,
    scope,
    local,
    version,
  };
}

export function mergeModel(base: ShareModel, patch: ShareModelPatch, opts: DecodeOptions = {}): ShareModel {
  const draft: ShareModel = {
    state: { ...base.state },
    inputs: { ...base.inputs },
    scope: { ...base.scope },
    local: { ...base.local },
    version: base.version,
  };
  if (patch.state) draft.state = { ...draft.state, ...patch.state };
  if (patch.inputs) draft.inputs = { ...draft.inputs, ...patch.inputs };
  if (patch.scope) draft.scope = { ...draft.scope, ...patch.scope };
  if (patch.local) draft.local = { ...draft.local, ...patch.local };
  if (patch.version !== undefined) draft.version = patch.version;
  return sanitizeModel(draft, opts);
}

export function decode(search: string | URL | URLSearchParams | null | undefined, options: DecodeOptions = {}): ShareModel {
  const params = toSearchParams(search);
  const base = createDefaultModel(options);
  const patch: ShareModelPatch = {};

  const statePatch: ShareModelPatch['state'] = {};
  const fipsParam = params.get('fips');
  const stateParam = params.get('state');
  const parsedFips = normalizeStateFips(fipsParam);
  const parsedCode = normalizeStateCode(stateParam);
  if (parsedCode) statePatch.code = parsedCode;
  if (parsedFips) {
    statePatch.fips = parsedFips;
  } else if (parsedCode && STATE_CODE_TO_FIPS[parsedCode]) {
    statePatch.fips = STATE_CODE_TO_FIPS[parsedCode];
  }
  if (statePatch.code && !statePatch.fips) {
    statePatch.fips = STATE_CODE_TO_FIPS[statePatch.code as StateCode] ?? null;
  }
  if (statePatch.fips && !statePatch.code) {
    statePatch.code = FIPS_TO_STATE_CODE[statePatch.fips] ?? null;
  }
  if (Object.keys(statePatch).length) patch.state = statePatch;

  const inputsPatch: ShareModelPatch['inputs'] = {};
  const fsParam = params.get('fs');
  if (fsParam !== null) {
    inputsPatch.filingStatus = sanitizeFilingStatus(fsParam, base.inputs.filingStatus);
  }
  const incParam = params.get('inc');
  if (incParam !== null) inputsPatch.income = sanitizeMoney(incParam, base.inputs.income);
  const ownParam = params.get('own') ?? params.get('ho');
  if (ownParam !== null) inputsPatch.homeowner = toBoolean(ownParam, base.inputs.homeowner);
  const homeParam = params.get('home') ?? params.get('hv');
  if (homeParam !== null) inputsPatch.homeValue = sanitizeMoney(homeParam, base.inputs.homeValue);
  const milesParam = params.get('miles') ?? params.get('mi');
  if (milesParam !== null) inputsPatch.miles = sanitizeInt(milesParam, base.inputs.miles);
  const mpgParam = params.get('mpg');
  if (mpgParam !== null) inputsPatch.mpg = sanitizeInt(mpgParam, base.inputs.mpg, 1);

  const spParam = params.get('sp');
  if (spParam !== null) {
    const asNumber = Number(spParam);
    if (Number.isFinite(asNumber)) {
      inputsPatch.spendingShare = sanitizeShare(asNumber / 100, base.inputs.spendingShare);
    }
  } else {
    const ssParam = params.get('ss');
    if (ssParam !== null) inputsPatch.spendingShare = sanitizeShare(ssParam, base.inputs.spendingShare);
  }

  const txParam = params.get('tx');
  if (txParam !== null) {
    const asNumber = Number(txParam);
    if (Number.isFinite(asNumber)) {
      inputsPatch.taxableShare = sanitizeShare(asNumber / 100, base.inputs.taxableShare);
    }
  } else {
    const tsParam = params.get('ts');
    if (tsParam !== null) inputsPatch.taxableShare = sanitizeShare(tsParam, base.inputs.taxableShare);
  }

  const fedParam = params.get('fed');
  if (fedParam !== null) inputsPatch.includeFederal = toBoolean(fedParam, base.inputs.includeFederal);
  const ltcgParam = params.get('ltcg');
  if (ltcgParam !== null) inputsPatch.ltcg = sanitizeMoney(ltcgParam, base.inputs.ltcg);
  const cigParam = params.get('cig');
  if (cigParam !== null) {
    inputsPatch.cigPacksPerWeek = sanitizeDecimal(cigParam, base.inputs.cigPacksPerWeek, 0, undefined, 2);
  }
  const alcParam = params.get('alc');
  if (alcParam !== null) {
    inputsPatch.alcoholUnitsPerWeek = sanitizeDecimal(alcParam, base.inputs.alcoholUnitsPerWeek, 0, undefined, 2);
  }
  if (Object.keys(inputsPatch).length) patch.inputs = inputsPatch;

  const scParam = params.get('sc');
  if (scParam !== null) patch.scope = maskToScope(scParam, base.scope);

  const localPatch: ShareModelPatch['local'] = {};
  const zipParam = params.get('zip');
  if (zipParam !== null) {
    const normalizedZip = normalizeZip(zipParam);
    if (normalizedZip) localPatch.zip = normalizedZip;
  }
  const countyParam = params.get('cty') ?? params.get('county');
  if (countyParam !== null) {
    const normalizedCounty = normalizeCountyFips(countyParam);
    if (normalizedCounty) localPatch.countyFips = normalizedCounty;
  }
  const lcParam = params.get('lc');
  if (lcParam !== null) localPatch.toggles = sanitizeInt(lcParam, base.local.toggles, 0);
  if (Object.keys(localPatch).length) patch.local = localPatch;

  const versionParam = params.get('ver');
  if (versionParam !== null) patch.version = versionParam.trim() || null;

  if (!Object.keys(patch).length) {
    return sanitizeModel(base, options);
  }

  return mergeModel(base, patch, options);
}

export function encode(model: ShareModel | ShareModelPatch, options: EncodeOptions = {}): URL {
  const sanitized = sanitizeModel(model, { packVersion: options.packVersion });
  const defaults = createDefaultModel({
    packVersion: options.packVersion ?? sanitized.version ?? undefined,
  });

  const base = resolveBase(options.baseUrl);
  const preservedHash = base.hash;
  base.search = '';

  const entries = new Map<string, string>();

  if (sanitized.state.fips) entries.set('fips', sanitized.state.fips);

  const fsCode = filingStatusToCode(sanitized.inputs.filingStatus);
  const fsDefault = filingStatusToCode(defaults.inputs.filingStatus);
  if (fsCode !== fsDefault) entries.set('fs', String(fsCode));

  if (sanitized.inputs.income !== defaults.inputs.income) {
    entries.set('inc', String(Math.max(0, Math.round(sanitized.inputs.income))));
  }

  const own = sanitized.inputs.homeowner ? '1' : '0';
  const ownDefault = defaults.inputs.homeowner ? '1' : '0';
  if (own !== ownDefault) entries.set('own', own);

  if (sanitized.inputs.homeValue !== defaults.inputs.homeValue) {
    entries.set('home', String(Math.max(0, Math.round(sanitized.inputs.homeValue))));
  }

  if (sanitized.inputs.miles !== defaults.inputs.miles) {
    entries.set('miles', String(Math.max(0, Math.trunc(sanitized.inputs.miles))));
  }

  if (sanitized.inputs.mpg !== defaults.inputs.mpg) {
    entries.set('mpg', String(Math.max(1, Math.trunc(sanitized.inputs.mpg))));
  }

  const spPercent = toPercentInt(sanitized.inputs.spendingShare);
  const spDefault = toPercentInt(defaults.inputs.spendingShare);
  if (spPercent !== spDefault) entries.set('sp', String(spPercent));

  const txPercent = toPercentInt(sanitized.inputs.taxableShare);
  const txDefault = toPercentInt(defaults.inputs.taxableShare);
  if (txPercent !== txDefault) entries.set('tx', String(txPercent));

  const fed = sanitized.inputs.includeFederal ? '1' : '0';
  const fedDefault = defaults.inputs.includeFederal ? '1' : '0';
  if (fed !== fedDefault) entries.set('fed', fed);

  if (sanitized.inputs.ltcg > 0) {
    entries.set('ltcg', String(Math.max(0, Math.round(sanitized.inputs.ltcg))));
  }

  const scopeMask = scopeToMask(sanitized.scope);
  const defaultMask = scopeToMask(defaults.scope);
  if (scopeMask !== defaultMask) entries.set('sc', String(scopeMask));

  if (sanitized.local.zip) entries.set('zip', sanitized.local.zip);
  if (sanitized.local.countyFips) entries.set('cty', sanitized.local.countyFips);
  if (sanitized.local.toggles > 0) entries.set('lc', String(Math.max(0, sanitized.local.toggles)));

  const defaultVersion = defaults.version ?? null;
  if (sanitized.version && sanitized.version !== defaultVersion) {
    entries.set('ver', sanitized.version);
  }

  const extras: [string, string][] = [];
  if (sanitized.inputs.cigPacksPerWeek > 0) {
    extras.push(['cig', formatDecimal(sanitized.inputs.cigPacksPerWeek, 2)]);
  }
  if (sanitized.inputs.alcoholUnitsPerWeek > 0) {
    extras.push(['alc', formatDecimal(sanitized.inputs.alcoholUnitsPerWeek, 2)]);
  }

  const parts: string[] = [];
  for (const key of CANONICAL_KEYS) {
    if (entries.has(key)) {
      const value = entries.get(key) ?? '';
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
    }
  }
  for (const [key, value] of extras) {
    parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
  }

  const query = parts.join('&');
  base.search = query ? `?${query}` : '';
  base.hash = preservedHash;
  return base;
}

export function encodeToString(model: ShareModel | ShareModelPatch, options: EncodeOptions = {}): string {
  return encode(model, options).toString();
}

function sanitizeFilingStatus(value: unknown, fallback: FilingStatus): FilingStatus {
  if (typeof value === 'string') {
    const key = value.trim().toLowerCase();
    if (STATUS_ALIASES[key]) return STATUS_ALIASES[key];
    const numeric = Number(key);
    if (Number.isFinite(numeric) && CODE_TO_STATUS[Math.trunc(numeric)]) {
      return CODE_TO_STATUS[Math.trunc(numeric)];
    }
  }
  if (typeof value === 'number' && Number.isFinite(value) && CODE_TO_STATUS[Math.trunc(value)]) {
    return CODE_TO_STATUS[Math.trunc(value)];
  }
  return fallback;
}

function toBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return fallback;
    return value !== 0;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return fallback;
    if (['1', 'true', 'yes', 'on', 'y', 't'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'off', 'n', 'f'].includes(normalized)) return false;
  }
  return fallback;
}

function sanitizeMoney(value: unknown, fallback: number): number {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return Math.max(0, Math.round(fallback));
    return Math.max(0, Math.round(value));
  }
  if (typeof value === 'string') {
    const cleaned = value.replace(/[^0-9-]/g, '');
    if (!cleaned) return Math.max(0, Math.round(fallback));
    const parsed = Number(cleaned);
    if (!Number.isFinite(parsed)) return Math.max(0, Math.round(fallback));
    return Math.max(0, Math.round(parsed));
  }
  return Math.max(0, Math.round(fallback));
}

function sanitizeInt(value: unknown, fallback: number, min = 0, max?: number): number {
  const numeric = (() => {
    if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value);
    if (typeof value === 'string') {
      const cleaned = value.replace(/[^0-9-]/g, '');
      if (!cleaned) return undefined;
      const parsed = Number(cleaned);
      if (Number.isFinite(parsed)) return Math.trunc(parsed);
    }
    return undefined;
  })();
  return clampInt(numeric ?? fallback, min, max);
}

function sanitizeDecimal(
  value: unknown,
  fallback: number,
  min = 0,
  max?: number,
  precision = 2,
): number {
  let numeric: number;
  if (typeof value === 'number') {
    numeric = value;
  } else if (typeof value === 'string') {
    const normalized = value.trim();
    if (!normalized) return roundDecimal(fallback, precision);
    numeric = Number(normalized);
    if (!Number.isFinite(numeric)) {
      const cleaned = normalized.replace(/[^0-9.-]/g, '');
      numeric = Number(cleaned);
    }
  } else {
    return roundDecimal(fallback, precision);
  }
  if (!Number.isFinite(numeric)) return roundDecimal(fallback, precision);
  if (typeof max === 'number' && Number.isFinite(max)) numeric = Math.min(max, numeric);
  numeric = Math.max(min, numeric);
  return roundDecimal(numeric, precision);
}

function sanitizeShare(value: unknown, fallback: number): number {
  let numeric: number;
  if (typeof value === 'number') {
    numeric = value;
  } else if (typeof value === 'string') {
    const normalized = value.trim();
    if (!normalized) return roundDecimal(fallback, 2);
    numeric = Number(normalized);
    if (!Number.isFinite(numeric)) {
      const cleaned = normalized.replace(/[^0-9.-]/g, '');
      numeric = Number(cleaned);
    }
  } else {
    return roundDecimal(fallback, 2);
  }
  if (!Number.isFinite(numeric)) return roundDecimal(fallback, 2);
  if (Math.abs(numeric) > 1 && Math.abs(numeric) <= 100) {
    numeric = numeric / 100;
  }
  numeric = Math.min(0.95, Math.max(0, numeric));
  return roundDecimal(numeric, 2);
}

function roundDecimal(value: number, precision = 2): number {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** Math.max(0, precision);
  return Math.round(value * factor) / factor;
}

function clampInt(value: number, min = 0, max?: number): number {
  let result = Number.isFinite(value) ? Math.trunc(value) : Math.trunc(min);
  result = Math.max(min, result);
  if (typeof max === 'number' && Number.isFinite(max)) {
    result = Math.min(Math.trunc(max), result);
  }
  return result;
}

function toPercentInt(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return clampInt(Math.round(value * 100), 0, 100);
}

function formatDecimal(value: number, precision = 2): string {
  const fixed = value.toFixed(precision);
  return fixed.replace(/(?:\.0+|(\.\d+?)0+)$/, '$1');
}

function normalizeZip(value: unknown): string | null {
  if (value == null) return null;
  const digits = String(value).trim().replace(/\D+/g, '');
  if (!digits) return null;
  if (digits.length >= 5) return digits.slice(0, 5);
  return digits.padStart(5, '0');
}

function normalizeCountyFips(value: unknown): string | null {
  if (value == null) return null;
  const digits = String(value).trim().replace(/\D+/g, '');
  if (!digits) return null;
  if (digits.length >= 5) return digits.slice(0, 5);
  return digits.padStart(5, '0');
}

function normalizeStateFips(value: unknown): string | null {
  if (value == null) return null;
  const digits = String(value).trim().replace(/\D+/g, '');
  if (!digits) return null;
  const normalized = digits.padStart(2, '0').slice(0, 2);
  return normalized === '00' ? null : normalized;
}

function normalizeStateCode(value: unknown): string | null {
  if (value == null) return null;
  const str = String(value).trim().toUpperCase();
  if (str.length !== 2) return null;
  return STATE_CODE_TO_FIPS[str as StateCode] ? str : null;
}

function toSearchParams(input: string | URL | URLSearchParams | null | undefined): URLSearchParams {
  if (input instanceof URLSearchParams) return input;
  if (input instanceof URL) return new URLSearchParams(input.search);
  if (typeof input === 'string') return new URLSearchParams(input);
  if (typeof window !== 'undefined' && typeof window.location?.search === 'string') {
    return new URLSearchParams(window.location.search);
  }
  return new URLSearchParams();
}

function resolveBase(base?: string | URL): URL {
  try {
    if (base instanceof URL) return new URL(base.toString());
    if (typeof base === 'string') {
      if (typeof window !== 'undefined') {
        return new URL(base, window.location.origin);
      }
      return new URL(base, FALLBACK_BASE_URL);
    }
    if (typeof window !== 'undefined' && window.location) {
      return new URL(window.location.href);
    }
  } catch {
    /* noop */
  }
  return new URL(FALLBACK_BASE_URL);
}

export interface TaxScopeCategory {
  id: string;
  label: string;
  visible: boolean;
  defaultEnabled: boolean;
}

export interface TaxScopeProfileSection {
  categories: TaxScopeCategory[];
}

export interface TaxScopeProfile {
  stateFips: string | null;
  countyFips: string | null;
  local: TaxScopeProfileSection;
  state: TaxScopeProfileSection;
  federal: TaxScopeProfileSection;
}

const BASE_LOCAL_CATEGORIES: TaxScopeCategory[] = [
  { id: 'local-income', label: 'Local income', visible: true, defaultEnabled: true },
  { id: 'local-sales', label: 'Local sales', visible: true, defaultEnabled: true },
  { id: 'lodging', label: 'Lodging & short-term stay', visible: true, defaultEnabled: false },
  { id: 'car-rental', label: 'Car rental', visible: true, defaultEnabled: false },
  { id: 'prepared-foods', label: 'Prepared foods', visible: true, defaultEnabled: false },
  { id: 'parking', label: 'Parking & admissions', visible: true, defaultEnabled: false },
];

const DEFAULT_PROFILE: TaxScopeProfile = {
  stateFips: null,
  countyFips: null,
  local: { categories: BASE_LOCAL_CATEGORIES },
  state: { categories: [] },
  federal: { categories: [] },
};

type CategoryOverride = Partial<Omit<TaxScopeCategory, 'id'>> & { id: string };

interface TaxScopeProfileOverrides {
  local?: {
    categories?: CategoryOverride[];
  };
}

const STATE_OVERRIDES: Record<string, TaxScopeProfileOverrides> = {
  // Texas (48) example: hide Parking and enable Lodging by default
  '48': {
    local: {
      categories: [
        { id: 'parking', visible: false },
        { id: 'lodging', defaultEnabled: true },
        { id: 'local-sales', label: 'Local sales (TX)', defaultEnabled: true },
      ],
    },
  },
};

export interface ResolveScopeProfileOptions {
  stateFips?: string | null;
  countyFips?: string | null;
}

export const resolveTaxScopeProfile = (opts: ResolveScopeProfileOptions = {}): TaxScopeProfile => {
  const stateFips = normalizeFips(opts.stateFips, 2);
  const countyFips = normalizeFips(opts.countyFips, 5);
  const localCategories = computeLocalCategories(stateFips, countyFips);
  return {
    stateFips,
    countyFips,
    local: { categories: localCategories },
    state: { categories: [] },
    federal: { categories: [] },
  };
};

const computeLocalCategories = (stateFips: string | null, countyFips: string | null) => {
  const categories = BASE_LOCAL_CATEGORIES.map((cat) => ({ ...cat }));
  const overrides = resolveOverrides(stateFips, countyFips);
  const overrideCategories = overrides.local?.categories || [];
  overrideCategories.forEach((override) => {
    const idx = categories.findIndex((cat) => cat.id === override.id);
    if (idx >= 0) {
      categories[idx] = { ...categories[idx], ...override };
    } else {
      categories.push({
        id: override.id,
        label: override.label || override.id,
        visible: override.visible !== false,
        defaultEnabled: !!override.defaultEnabled,
      });
    }
  });
  return categories;
};

const resolveOverrides = (stateFips: string | null, countyFips: string | null): TaxScopeProfileOverrides => {
  if (stateFips && STATE_OVERRIDES[stateFips]) return STATE_OVERRIDES[stateFips];
  return {};
};

const normalizeFips = (value: string | number | null | undefined, width: number): string | null => {
  if (value == null) return null;
  const digits = String(value).trim().replace(/\D+/g, '');
  if (!digits) return null;
  return digits.padStart(width, '0').slice(0, width);
};

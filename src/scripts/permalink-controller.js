import {
  createDefaultModel,
  decode as decodeShare,
  encode as encodeShare,
  mergeModel,
} from '../lib/share.ts';

const win = typeof window !== 'undefined' ? window : undefined;

const FIPS_TO_STATE_CODE = {
  '01': 'AL',
  '02': 'AK',
  '04': 'AZ',
  '05': 'AR',
  '06': 'CA',
  '08': 'CO',
  '09': 'CT',
  '10': 'DE',
  '11': 'DC',
  '12': 'FL',
  '13': 'GA',
  '15': 'HI',
  '16': 'ID',
  '17': 'IL',
  '18': 'IN',
  '19': 'IA',
  '20': 'KS',
  '21': 'KY',
  '22': 'LA',
  '23': 'ME',
  '24': 'MD',
  '25': 'MA',
  '26': 'MI',
  '27': 'MN',
  '28': 'MS',
  '29': 'MO',
  '30': 'MT',
  '31': 'NE',
  '32': 'NV',
  '33': 'NH',
  '34': 'NJ',
  '35': 'NM',
  '36': 'NY',
  '37': 'NC',
  '38': 'ND',
  '39': 'OH',
  '40': 'OK',
  '41': 'OR',
  '42': 'PA',
  '44': 'RI',
  '45': 'SC',
  '46': 'SD',
  '47': 'TN',
  '48': 'TX',
  '49': 'UT',
  '50': 'VT',
  '51': 'VA',
  '53': 'WA',
  '54': 'WV',
  '55': 'WI',
  '56': 'WY',
  '72': 'PR',
};

const STATE_CODE_TO_FIPS = Object.fromEntries(
  Object.entries(FIPS_TO_STATE_CODE).map(([fips, code]) => [code, fips]),
);

const LOCAL_CATEGORY_KEYS = ['local-income', 'local-sales', 'lodging', 'car-rental', 'prepared-foods', 'parking'];
const LOCAL_CATEGORY_DEFAULTS = {
  'local-income': true,
  'local-sales': true,
  lodging: false,
  'car-rental': false,
  'prepared-foods': false,
  parking: false,
};

const DEFAULT_SCOPE_PROFILE = {
  stateFips: null,
  countyFips: null,
  local: {
    categories: [
      { id: 'local-income', label: 'Local income', visible: true, defaultEnabled: true },
      { id: 'local-sales', label: 'Local sales', visible: true, defaultEnabled: true },
      { id: 'lodging', label: 'Lodging & short-term stay', visible: true, defaultEnabled: false },
      { id: 'car-rental', label: 'Car rental', visible: true, defaultEnabled: false },
      { id: 'prepared-foods', label: 'Prepared foods', visible: true, defaultEnabled: false },
      { id: 'parking', label: 'Parking & admissions', visible: true, defaultEnabled: false },
    ],
  },
  state: { categories: [] },
  federal: { categories: [] },
};

const resolveTaxScopeProfile = (opts = {}) => {
  const normalizeFips = (val, width) => {
    if (val == null) return null;
    const digits = String(val).trim().replace(/\D+/g, '');
    if (!digits) return null;
    return digits.padStart(width, '0').slice(0, width);
  };
  const stateFips = normalizeFips(opts.stateFips, 2);
  const countyFips = normalizeFips(opts.countyFips, 5);
  return {
    ...DEFAULT_SCOPE_PROFILE,
    stateFips,
    countyFips,
    local: { categories: DEFAULT_SCOPE_PROFILE.local.categories },
  };
};

const createCategoryState = (mask = 0) => {
  const categories = { ...LOCAL_CATEGORY_DEFAULTS };
  if (typeof mask === 'number' && Number.isFinite(mask)) {
    LOCAL_CATEGORY_KEYS.forEach((key, idx) => {
      categories[key] = (mask & (1 << idx)) === (1 << idx);
    });
  }
  return categories;
};

const mergeCategories = (base = LOCAL_CATEGORY_DEFAULTS, patch = {}) => {
  let mutated = false;
  const next = { ...base };
  if (patch && typeof patch === 'object') {
    LOCAL_CATEGORY_KEYS.forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(patch, key)) {
        const desired = !!patch[key];
        if (next[key] !== desired) {
          next[key] = desired;
          mutated = true;
        }
      }
    });
  }
  return mutated ? next : base;
};

const encodeCategories = (categories = LOCAL_CATEGORY_DEFAULTS) => {
  let mask = 0;
  LOCAL_CATEGORY_KEYS.forEach((key, idx) => {
    const active = Object.prototype.hasOwnProperty.call(categories, key) ? !!categories[key] : LOCAL_CATEGORY_DEFAULTS[key];
    if (active) mask |= 1 << idx;
  });
  return mask;
};

const normalizeStateFips = (value) => {
  if (value == null) return null;
  const digits = String(value).trim().replace(/\D+/g, '');
  if (!digits) return null;
  const normalized = digits.padStart(2, '0').slice(0, 2);
  return normalized === '00' ? null : normalized;
};

const normalizeCountyFips = (value) => {
  if (value == null) return null;
  const digits = String(value).trim().replace(/\D+/g, '');
  if (!digits) return null;
  if (digits.length >= 5) return digits.slice(0, 5);
  if (digits.length <= 2) return digits.padStart(5, '0');
  return digits.padStart(5, '0');
};

const normalizeZip = (value) => {
  if (value == null) return null;
  const digits = String(value).trim().replace(/\D+/g, '');
  if (!digits) return null;
  if (digits.length >= 5) return digits.slice(0, 5);
  return digits.padStart(5, '0');
};

const normalizeCity = (value) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

if (win) {
  const log = (...args) => {
    try {
      console.log('[permalink-controller]', ...args);
    } catch (_) {}
  };
  const runSoon =
    typeof queueMicrotask === 'function'
      ? queueMicrotask.bind(win)
      : (fn) => win.setTimeout(fn, 0);

  const resolvePackVersion = () => {
    try {
      const seeded = win.__T1_PACK__ || win.__t1_pack;
      const version = seeded?.registry?.pack_version;
      if (typeof version === 'string' && version.trim()) return version;
    } catch (err) {
      try {
        console.warn('permalink: failed to resolve pack version', err);
      } catch (_) {}
    }
    return null;
  };

  const PACK_VERSION = win.__T1_PACK_VERSION__ || resolvePackVersion();
  win.__T1_PACK_VERSION__ = PACK_VERSION || null;

  const decodeCurrentLocation = () => {
    try {
      return decodeShare(win.location, { packVersion: PACK_VERSION || undefined });
    } catch (err) {
      try {
        console.warn('permalink: decode failed, using defaults', err);
      } catch (_) {}
      return createDefaultModel({ packVersion: PACK_VERSION || undefined });
    }
  };

  let model = win.__T1_SHARE_MODEL__ || decodeCurrentLocation();
  win.__T1_SHARE_MODEL__ = model;

  let geoSelection = {
    layer: 'state',
    stateFips: normalizeStateFips(model?.state?.fips),
    countyFips: normalizeCountyFips(model?.local?.countyFips),
  };
  const initialLocalToggles = typeof model?.local?.toggles === 'number' ? model.local.toggles : 0;
  let localScope = {
    enabled: !!(model?.scope?.local),
    zip: normalizeZip(model?.local?.zip),
    city: normalizeCity(model?.local?.city),
    countyFips: normalizeCountyFips(model?.local?.countyFips),
    stateFips: normalizeStateFips(model?.state?.fips),
    categories: createCategoryState(initialLocalToggles),
    toggles: initialLocalToggles,
  };
  let scopeProfile = resolveTaxScopeProfile({
    stateFips: geoSelection.stateFips,
    countyFips: geoSelection.countyFips || localScope.countyFips,
  });
  let controller = null;

  let timer = 0;

  const updateGeoSelectionState = (patch = {}) => {
    const nextLayer = patch.layer === 'county' ? 'county' : 'state';
    const hasStateCode = Object.prototype.hasOwnProperty.call(patch, 'stateCode');
    let nextState = geoSelection.stateFips;
    if (patch.stateFips !== undefined) {
      nextState = normalizeStateFips(patch.stateFips);
    } else if (hasStateCode) {
      const code = String(patch.stateCode || '').toUpperCase();
      nextState = STATE_CODE_TO_FIPS[code] || null;
    }
    const nextCounty =
      patch.countyFips === undefined ? geoSelection.countyFips : normalizeCountyFips(patch.countyFips);
    const changed =
      nextLayer !== geoSelection.layer ||
      nextState !== geoSelection.stateFips ||
      nextCounty !== geoSelection.countyFips;
    if (changed) {
      geoSelection = { layer: nextLayer, stateFips: nextState, countyFips: nextCounty };
      if (controller) controller.geoSelection = { ...geoSelection };
    }
    return changed;
  };

  const updateLocalScopeState = (patch = {}) => {
    const hasCity = Object.prototype.hasOwnProperty.call(patch, 'city');
    const hasZip = Object.prototype.hasOwnProperty.call(patch, 'zip');
    const hasEnabled = Object.prototype.hasOwnProperty.call(patch, 'enabled');
    const hasCounty = Object.prototype.hasOwnProperty.call(patch, 'countyFips');
    const hasStateField = Object.prototype.hasOwnProperty.call(patch, 'stateFips');
    const hasCategories = Object.prototype.hasOwnProperty.call(patch, 'categories');
    const hasToggles = Object.prototype.hasOwnProperty.call(patch, 'toggles');
    const next = {
      enabled: hasEnabled ? !!patch.enabled : localScope.enabled,
      zip: hasZip ? normalizeZip(patch.zip) : localScope.zip,
      city: hasCity ? normalizeCity(patch.city) : localScope.city,
      countyFips: hasCounty ? normalizeCountyFips(patch.countyFips) : localScope.countyFips,
      stateFips: hasStateField ? normalizeStateFips(patch.stateFips) : localScope.stateFips,
      categories: hasCategories ? mergeCategories(localScope.categories, patch.categories) : localScope.categories,
      toggles: localScope.toggles,
    };
    next.toggles = hasToggles
      ? Math.max(0, Number(patch.toggles) || 0)
      : encodeCategories(next.categories);
    const changed =
      next.enabled !== localScope.enabled ||
      next.zip !== localScope.zip ||
      next.city !== localScope.city ||
      next.countyFips !== localScope.countyFips ||
      next.stateFips !== localScope.stateFips ||
      next.toggles !== localScope.toggles ||
      next.categories !== localScope.categories;
    if (changed) {
      localScope = next;
      if (controller) controller.localScope = { ...localScope };
    }
    return changed;
  };

  const emitGeoSelection = (origin = 'controller') => {
    const stateDetail =
      geoSelection.stateFips && geoSelection.layer === 'state'
        ? {
            fips: geoSelection.stateFips,
            code: FIPS_TO_STATE_CODE[geoSelection.stateFips] || null,
            geoSelection: { ...geoSelection },
            __origin: origin,
          }
        : {
            geoSelection: { ...geoSelection },
            __origin: origin,
          };
    try {
      win.dispatchEvent(
        new CustomEvent('t1:geo-selection', {
          detail: { ...geoSelection, __origin: origin },
        }),
      );
    } catch (_) {}
    try {
      win.dispatchEvent(new CustomEvent('t1:state', { detail: stateDetail }));
    } catch (_) {}
  };

  const emitLocalScope = (origin = 'controller') => {
    try {
      win.dispatchEvent(
        new CustomEvent('t1:local-scope', {
          detail: { ...localScope, __origin: origin },
        }),
      );
    } catch (_) {}
  };

  const emitScopeProfile = (origin = 'controller') => {
    try {
      win.dispatchEvent(
        new CustomEvent('t1:scope-profile', {
          detail: { ...scopeProfile, __origin: origin },
        }),
      );
    } catch (_) {}
  };

  const syncControllerFromModel = ({ emitGeo = false, emitLocal = false, origin = 'permalink' } = {}) => {
    const geoChanged = updateGeoSelectionState({
      layer: 'state',
      stateFips: model?.state?.fips || null,
      countyFips: model?.local?.countyFips || null,
    });
    const localChanged = updateLocalScopeState({
      enabled: !!(model?.scope?.local),
      zip: model?.local?.zip || null,
      countyFips: model?.local?.countyFips || null,
      stateFips: model?.state?.fips || null,
      categories: createCategoryState(typeof model?.local?.toggles === 'number' ? model.local.toggles : 0),
    });
    if (geoChanged && emitGeo) emitGeoSelection(origin);
    if (localChanged && emitLocal) emitLocalScope(origin);
    const shouldUseCounty = localScope.enabled && localScope.countyFips;
    if (shouldUseCounty) {
      const fallbackState = localScope.stateFips || model?.state?.fips || geoSelection.stateFips;
      if (fallbackState) {
        const promoted = updateGeoSelectionState({
          layer: 'county',
          stateFips: fallbackState,
          countyFips: localScope.countyFips,
        });
        if (promoted && emitGeo) emitGeoSelection(origin);
      }
    } else if (!shouldUseCounty && geoSelection.layer === 'county') {
      const reverted = updateGeoSelectionState({ layer: 'state', countyFips: null });
      if (reverted && emitGeo) emitGeoSelection(origin);
    }
    const nextProfile = resolveTaxScopeProfile({
      stateFips: geoSelection.stateFips || localScope.stateFips,
      countyFips: geoSelection.countyFips || localScope.countyFips,
    });
    scopeProfile = nextProfile;
    if (emitLocal || emitGeo) emitScopeProfile(origin);
  };

  const encodeCurrent = () =>
    encodeShare(model, {
      baseUrl: win.location.href,
      packVersion: PACK_VERSION || undefined,
    });

  const flush = ({ push = false, state } = {}) => {
    try {
      const encoded = encodeCurrent();
      const href = encoded.toString();
      const payload =
        state !== undefined
          ? state
          : model.state && model.state.fips
            ? { fips: model.state.fips }
            : {};
      if (push && typeof win.history?.pushState === 'function') {
        win.history.pushState(payload, '', href);
      } else if (typeof win.history?.replaceState === 'function') {
        win.history.replaceState(payload, '', href);
      }
    } catch (err) {
      try {
        console.warn('permalink: flush failed', err);
      } catch (_) {}
    }
  };

  const scheduleURLUpdate = ({ delay = 150, push = false, state } = {}) => {
    if (push) {
      flush({ push: true, state });
      return;
    }
    if (timer) win.clearTimeout(timer);
    timer = win.setTimeout(() => {
      flush({ push: false, state });
      timer = 0;
    }, delay);
  };

  const setModel = (patch = {}) => {
    try {
      model = mergeModel(model, patch, { packVersion: PACK_VERSION || undefined });
      win.__T1_SHARE_MODEL__ = model;
      syncControllerFromModel({ emitGeo: false, emitLocal: false, origin: 'permalink-model' });
    } catch (err) {
      try {
        console.warn('permalink: merge failed', err);
      } catch (_) {}
    }
    return model;
  };

  const controllerApi = {
    geoSelection: { ...geoSelection },
    localScope: { ...localScope },
    getGeoSelection: () => ({ ...geoSelection }),
    setGeoSelection: (patch = {}, opts = {}) => {
      const changed = updateGeoSelectionState(patch);
      const sharePatch = {};
      const stateProvided =
        Object.prototype.hasOwnProperty.call(patch, 'stateFips') ||
        Object.prototype.hasOwnProperty.call(patch, 'stateCode');
      const countyProvided = Object.prototype.hasOwnProperty.call(patch, 'countyFips');
      if (stateProvided) {
        sharePatch.state = {
          fips: geoSelection.stateFips,
          code: geoSelection.stateFips ? FIPS_TO_STATE_CODE[geoSelection.stateFips] || null : null,
        };
      }
      if (countyProvided) {
        sharePatch.local = { countyFips: geoSelection.countyFips };
      }
      const shareChanged = Object.keys(sharePatch).length > 0;
      if (shareChanged) {
        setModel(sharePatch);
      }
      const statePayload =
        geoSelection.stateFips && geoSelection.layer === 'state' ? { fips: geoSelection.stateFips } : {};
      if ((changed || stateProvided || shareChanged) && opts.schedule !== false) {
        scheduleURLUpdate({
          push: !!opts.push,
          state: statePayload,
          delay: typeof opts.delay === 'number' ? opts.delay : 150,
        });
      }
      if (changed && opts.emit !== false) {
        emitGeoSelection(opts.origin || 'controller');
      }
      return { ...geoSelection };
    },
    getLocalScope: () => ({ ...localScope }),
    getScopeProfile: () => ({ ...scopeProfile, local: { categories: [...scopeProfile.local.categories] } }),
    setLocalScope: (patch = {}, opts = {}) => {
      const changed = updateLocalScopeState(patch);
      if (!changed) return { ...localScope };
      const sharePatch = {};
      const localPatch = {};
      if (Object.prototype.hasOwnProperty.call(patch, 'zip')) {
        localPatch.zip = localScope.zip;
      }
      if (Object.prototype.hasOwnProperty.call(patch, 'countyFips')) {
        localPatch.countyFips = localScope.countyFips;
      }
      if (
        Object.prototype.hasOwnProperty.call(patch, 'categories') ||
        Object.prototype.hasOwnProperty.call(patch, 'toggles')
      ) {
        localPatch.toggles = localScope.toggles;
      }
      if (Object.keys(localPatch).length) {
        sharePatch.local = localPatch;
      }
      if (Object.prototype.hasOwnProperty.call(patch, 'enabled')) {
        sharePatch.scope = { local: localScope.enabled };
      }
      if (Object.keys(sharePatch).length) {
        setModel(sharePatch);
        if (opts.schedule !== false) {
          scheduleURLUpdate({ delay: typeof opts.delay === 'number' ? opts.delay : 150 });
        }
      }
      if (opts.emit !== false) {
        emitLocalScope(opts.origin || 'controller');
      }
      return { ...localScope };
    },
  };

  controller = controllerApi;
  try {
    win.__T1_CONTROLLER__ = controller;
    log('controller attached');
  } catch (_) {}
  syncControllerFromModel({ emitGeo: false, emitLocal: false, origin: 'permalink-init' });

  const broadcast = (origin = 'permalink') => {
    try {
      emitGeoSelection(origin);
      emitLocalScope(origin);
      win.dispatchEvent(
        new CustomEvent('t1:scope-changed', {
          detail: { ...model.scope, __origin: origin },
        }),
      );
      win.dispatchEvent(
        new CustomEvent('t1:inputs', {
          detail: {
            ...model.inputs,
            scopes: { ...model.scope },
            locality: {
              zip: model.local.zip || undefined,
              countyFips: model.local.countyFips || undefined,
              fipsCounty: model.local.countyFips || undefined,
              state: model.state.code || undefined,
              stateFips: model.state.fips || undefined,
            },
          },
        }),
      );
      if (model.local.zip || model.local.countyFips) {
        win.dispatchEvent(
          new CustomEvent('t1:locality-changed', {
            detail: {
              zip: model.local.zip || undefined,
              countyFips: model.local.countyFips || undefined,
              fipsCounty: model.local.countyFips || undefined,
              state: model.state.code || undefined,
              stateFips: model.state.fips || undefined,
              source: origin,
            },
          }),
        );
      }
    } catch (err) {
      try {
        console.warn('permalink: broadcast failed', err);
      } catch (_) {}
    }
  };

  win.__T1_SHARE_UTILS__ = {
    createDefaultModel,
    mergeModel,
    encode: encodeShare,
  };

  win.__T1_SHARE__ = {
    version: PACK_VERSION || null,
    getModel: () => model,
    setModel,
    scheduleURLUpdate,
    encode: () => encodeCurrent(),
    flush,
  };

  flush();
  runSoon(() => broadcast('permalink'));

  win.addEventListener('popstate', () => {
    try {
      model = decodeCurrentLocation();
      win.__T1_SHARE_MODEL__ = model;
      syncControllerFromModel({ emitGeo: false, emitLocal: false, origin: 'permalink-popstate' });
      runSoon(() => broadcast('permalink-popstate'));
    } catch (err) {
      try {
        console.warn('permalink: popstate decode failed', err);
      } catch (_) {}
    }
  });
}

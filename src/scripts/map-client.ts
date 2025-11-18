import { geoAlbersUsa, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';

const WIDTH = 960;
const HEIGHT = 520;
const SVG_NS = 'http://www.w3.org/2000/svg';
const COUNTY_FALLBACK_URL = '/local/counties-sample.geojson';

const STATE_FIPS_TO_CODE: Record<string, string> = {
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

const STATE_CODE_TO_FIPS: Record<string, string> = Object.fromEntries(
  Object.entries(STATE_FIPS_TO_CODE).map(([fips, code]) => [code, fips]),
);

type ShareController = {
  setModel?: (patch: Record<string, unknown>) => Record<string, unknown>;
  scheduleURLUpdate?: (opts: { push?: boolean; state?: Record<string, unknown>; delay?: number }) => void;
};

type CountyEntry = {
  el: SVGPathElement;
  stateFips: string;
  stateCode: string;
  name: string | null;
};

declare global {
  interface Window {
    __T1_SHARE__?: ShareController;
    __T1_SHARE_MODEL__?: Record<string, unknown>;
    __T1_PACK__?: Record<string, unknown>;
    __t1_pack?: Record<string, unknown>;
    __T1_MAP_READY__?: boolean;
  }
}

const normalizeStateFips = (value: unknown): string | null => {
  if (value == null) return null;
  const digits = String(value).replace(/\D+/g, '');
  if (!digits) return null;
  return digits.slice(0, 2).padStart(2, '0');
};

const normalizeCountyFips = (value: unknown): string | null => {
  if (value == null) return null;
  const digits = String(value).replace(/\D+/g, '');
  if (!digits) return null;
  return digits.slice(0, 5).padStart(5, '0');
};

const fipsToCode = (fips: string | null): string | null => {
  if (!fips) return null;
  const normalized = normalizeStateFips(fips);
  return normalized ? STATE_FIPS_TO_CODE[normalized] || null : null;
};

const codeToFips = (code: string | null): string | null => {
  if (!code) return null;
  return STATE_CODE_TO_FIPS[code.toUpperCase()] || null;
};

let projectionPromise: Promise<ReturnType<typeof geoPath> | null> | null = null;
let countiesPromise: Promise<void> | null = null;

const ensureGeoProjection = () => {
  if (projectionPromise) return projectionPromise;
  projectionPromise = (async () => {
    try {
      const res = await fetch('/topo/states-10m.json', { cache: 'force-cache' });
      if (!res.ok) throw new Error(`states topo fetch failed: ${res.status}`);
      const topo = await res.json();
      const states = feature(topo, topo.objects.states);
      const projection = geoAlbersUsa().fitSize([WIDTH, HEIGHT], states as any);
      return geoPath(projection);
    } catch (err) {
      console.warn('map: failed to initialise geography', err);
      return null;
    }
  })();
  return projectionPromise;
};

const getCountySourceURL = (): string => {
  try {
    const pack = window.__T1_PACK__ || window.__t1_pack || null;
    const candidate = (pack?.registry as Record<string, any> | undefined)?.layers?.counties;
    if (candidate && typeof candidate.href === 'string' && candidate.href.trim()) {
      return candidate.href;
    }
  } catch {
    /* noop */
  }
  return COUNTY_FALLBACK_URL;
};

const initMapClient = () => {
  if (typeof window === 'undefined') return;
  if (window.__T1_MAP_READY__) return;

  const root = document.querySelector<HTMLElement>('[data-t1-map]');
  if (!root) return;

  window.__T1_MAP_READY__ = true;

  const svg = root.querySelector<SVGSVGElement>('svg');
  const countyLayer = svg?.querySelector<SVGGElement>('[data-layer="counties"]');
  const mapGroup = svg?.querySelector<SVGGElement>('#mapGroup');
  const badge = root.querySelector<HTMLElement>('#map-selected');

  if (!svg || !countyLayer || !mapGroup) return;

  const shareCtrl: ShareController | null = window.__T1_SHARE__ || null;

  const countyEntries = new Map<string, CountyEntry>();

  let selectedStateFips =
    normalizeStateFips(root.getAttribute('data-state-fips')) ||
    normalizeStateFips(window.__T1_SHARE_MODEL__?.state && (window.__T1_SHARE_MODEL__!.state as any).fips);
  let selectedCountyFips =
    normalizeCountyFips(root.getAttribute('data-county-fips')) ||
    normalizeCountyFips(window.__T1_SHARE_MODEL__?.local && (window.__T1_SHARE_MODEL__!.local as any).countyFips);
  let localScopeEnabled =
    root.getAttribute('data-local-active') === '1' ||
    root.getAttribute('data-local-enabled') === '1' ||
    false;

  const logMapProps = () => {
    try {
      console.log('map: props', {
        state: selectedStateFips,
        county: selectedCountyFips,
        localScopeEnabled,
      });
    } catch {
      /* noop */
    }
  };

  const setBadge = (fips: string | null) => {
    if (!badge) return;
    if (!fips) {
      badge.textContent = '--';
      return;
    }
    const code = fipsToCode(fips);
    badge.textContent = code || fips;
  };

  const syncHistoryParam = (fips: string | null, push = false) => {
    try {
      const url = new URL(window.location.href);
      if (fips) url.searchParams.set('fips', fips);
      else url.searchParams.delete('fips');
      const state = fips ? { fips } : {};
      if (push && typeof history.pushState === 'function') {
        history.pushState(state, '', url);
      } else if (typeof history.replaceState === 'function') {
        history.replaceState(state, '', url);
      } else {
        window.location.replace(url);
      }
    } catch {
      /* noop */
    }
  };

  const applySharePatch = (patch: Record<string, unknown>, opts: { push?: boolean } = {}) => {
    if (shareCtrl?.setModel) {
      shareCtrl.setModel(patch);
      shareCtrl.scheduleURLUpdate?.({
        push: !!opts.push,
        state: patch.state as Record<string, unknown>,
        delay: opts.push ? 0 : 150,
      });
    } else {
      syncHistoryParam((patch.state as any)?.fips ?? null, opts.push);
    }
  };

  const emitStateEvent = (fips: string | null) => {
    const detail = fips ? { fips, code: fipsToCode(fips) } : null;
    window.dispatchEvent(new CustomEvent('t1:state', { detail }));
  };

  const highlightCounty = (fips: string | null) => {
    if (selectedCountyFips) {
      const prev = countyEntries.get(selectedCountyFips);
      prev?.el.classList.remove('county--selected');
    }
    selectedCountyFips = fips;
    if (selectedCountyFips) {
      const next = countyEntries.get(selectedCountyFips);
      next?.el.classList.add('county--selected');
    }
    if (fips) {
      root.setAttribute('data-county-fips', fips);
    } else {
      root.setAttribute('data-county-fips', '');
    }
  };

  const setCountyVisibility = (stateFips: string | null) => {
    const normalized = normalizeStateFips(stateFips);
    countyEntries.forEach((entry) => {
      if (normalized && entry.stateFips === normalized) {
        entry.el.setAttribute('data-visible', '1');
      } else {
        entry.el.removeAttribute('data-visible');
      }
    });
    if (!normalized) highlightCounty(null);
    if (selectedCountyFips) {
      const entry = countyEntries.get(selectedCountyFips);
      if (!entry || entry.stateFips !== normalized) {
        highlightCounty(null);
      }
    }
  };

  const ensureCountyLayer = async () => {
    if (countiesPromise) {
      await countiesPromise;
      return;
    }
    countiesPromise = (async () => {
      const geo = await ensureGeoProjection();
      if (!geo) return;
      try {
        const res = await fetch(getCountySourceURL(), { cache: 'reload' });
        if (!res.ok) throw new Error(`counties fetch failed: ${res.status}`);
        const data = await res.json();
        const features: any[] = Array.isArray(data?.features) ? data.features : [];
        features.forEach((entry) => {
          const props = entry?.properties || {};
          const countyFips = normalizeCountyFips(props.fips || props.GEOID);
          if (!countyFips) return;
          const stateF = normalizeStateFips(props.stateFips || countyFips.slice(0, 2));
          const stateCode = props.state || fipsToCode(stateF || null) || null;
          const name = typeof props.name === 'string' && props.name.trim() ? props.name : props.NAME || null;
          const pathData = geo(entry);
          if (!pathData || !stateF) return;
          const path = document.createElementNS(SVG_NS, 'path');
          path.setAttribute('d', pathData);
          path.setAttribute('data-county-fips', countyFips);
          path.setAttribute('data-state', stateCode ?? '');
          path.setAttribute('tabindex', '-1');
          if (name) path.setAttribute('data-county-name', name);
          path.classList.add('county');
          path.addEventListener('click', () => {
            if (!localScopeEnabled || !selectedStateFips) return;
            handleCountySelection(countyFips);
          });
          countyLayer.appendChild(path);
          countyEntries.set(countyFips, { el: path, stateFips: stateF, stateCode: stateCode || '', name });
        });
      } catch (err) {
        console.warn('map: failed to load counties overlay', err);
      }
    })();
    await countiesPromise;
  };

  const syncCountyLayer = () => {
    const shouldShow = localScopeEnabled && !!selectedStateFips;
    root.setAttribute('data-local-active', shouldShow ? '1' : '0');
    countyLayer.setAttribute('aria-hidden', shouldShow ? 'false' : 'true');
    if (!shouldShow) {
      setCountyVisibility(null);
      highlightCounty(null);
      return;
    }
    ensureCountyLayer().then(() => {
      setCountyVisibility(selectedStateFips);
      if (selectedCountyFips) highlightCounty(selectedCountyFips);
    });
  };

  const clearSelection = ({ emit = true, push = false } = {}) => {
    if (selectedStateFips) {
      const prev = svg.querySelector<SVGPathElement>(`.state[data-fips="${selectedStateFips}"]`);
      prev?.classList.remove('state--selected');
    }
    selectedStateFips = null;
    root.setAttribute('data-state-fips', '');
    setBadge(null);
    highlightCounty(null);
    syncCountyLayer();
    if (emit) {
      applySharePatch(
        {
          state: { fips: null, code: null },
          local: { stateFips: null, countyFips: null, countyName: null },
        },
        { push },
      );
      emitStateEvent(null);
    }
  };

  const selectState = (fips: string, { emit = true, push = false } = {}) => {
    const normalized = normalizeStateFips(fips);
    if (!normalized) {
      clearSelection({ emit, push });
      return;
    }
    if (selectedStateFips === normalized) {
      if (emit) emitStateEvent(normalized);
      return;
    }
    const next = svg.querySelector<SVGPathElement>(`.state[data-fips="${normalized}"]`);
    if (!next) return;

    if (selectedStateFips) {
      const prev = svg.querySelector<SVGPathElement>(`.state[data-fips="${selectedStateFips}"]`);
      prev?.classList.remove('state--selected');
    }

    selectedStateFips = normalized;
    root.setAttribute('data-state-fips', normalized);
    highlightCounty(null);
    next.classList.add('state--selected');
    setBadge(normalized);
    try {
      mapGroup.appendChild(next);
    } catch {
      /* noop */
    }
    syncCountyLayer();
    if (emit) {
      applySharePatch(
        {
          state: { fips: normalized, code: fipsToCode(normalized) },
          local: { stateFips: normalized, countyFips: null, countyName: null },
        },
        { push },
      );
      emitStateEvent(normalized);
    }
  };

  const handleCountySelection = (countyFips: string) => {
    const entry = countyEntries.get(countyFips);
    if (!entry) return;
    highlightCounty(countyFips);
    const stateFips = entry.stateFips;
    const detail = {
      countyFips,
      countyName: entry.name || null,
      stateFips,
      stateCode: entry.stateCode || fipsToCode(stateFips),
    };
    window.dispatchEvent(new CustomEvent('t1:map-county-selected', { detail }));
    logMapProps();
  };

  svg.querySelectorAll<SVGPathElement>('.state').forEach((path) => {
    path.style.pointerEvents = 'auto';
    path.addEventListener('click', (event) => {
      event.preventDefault();
      const fips = path.getAttribute('data-fips');
      if (!fips) return;
      selectState(fips, { emit: true, push: true });
      logMapProps();
    });
  });

  window.addEventListener('popstate', (event) => {
    const f = (event.state && (event.state as any).fips) || (() => {
      try {
        return new URL(window.location.href).searchParams.get('fips');
      } catch {
        return null;
      }
    })();
    if (f) {
      selectState(f, { emit: true, push: false });
    } else {
      clearSelection({ emit: true, push: false });
    }
  });

  window.addEventListener('t1:scope-changed', (event) => {
    const detail = (event as CustomEvent).detail || {};
    if (Object.prototype.hasOwnProperty.call(detail, 'local')) {
      localScopeEnabled = !!detail.local;
      syncCountyLayer();
      logMapProps();
    }
  });

  window.addEventListener('t1:map-props', (event) => {
    const detail = (event as CustomEvent).detail || {};
    if (Object.prototype.hasOwnProperty.call(detail, 'stateFips')) {
      const nextState = normalizeStateFips(detail.stateFips);
      if (nextState) {
        selectState(nextState, { emit: false, push: false });
      } else {
        clearSelection({ emit: false, push: false });
      }
    }
    if (Object.prototype.hasOwnProperty.call(detail, 'countyFips')) {
      const nextCounty = normalizeCountyFips(detail.countyFips);
      if (nextCounty) {
        highlightCounty(nextCounty);
      } else {
        highlightCounty(null);
      }
    }
    if (Object.prototype.hasOwnProperty.call(detail, 'localScopeEnabled')) {
      localScopeEnabled = !!detail.localScopeEnabled;
      syncCountyLayer();
    }
    logMapProps();
  });

  window.addEventListener('t1:locality-changed', (event) => {
    const detail = (event as CustomEvent).detail || {};
    if (detail && detail.source === 'map') return;
    const nextState = normalizeStateFips(detail.stateFips);
    if (nextState) {
      selectState(nextState, { emit: false, push: false });
    }
    if (detail.fipsCounty || detail.countyFips) {
      const county = normalizeCountyFips(detail.fipsCounty || detail.countyFips);
      if (county) {
        highlightCounty(county);
      }
    } else {
      highlightCounty(null);
    }
  });

  window.addEventListener('t1:state', (event) => {
    const detail = (event as CustomEvent).detail || {};
    if (detail && detail.fips) {
      selectState(detail.fips, { emit: false, push: false });
    } else if (detail && detail.code) {
      const fips = codeToFips(detail.code);
      if (fips) selectState(fips, { emit: false, push: false });
    }
  });

  (function applyInitialState() {
    if (selectedStateFips) {
      selectState(selectedStateFips, { emit: true, push: false });
      if (selectedCountyFips) highlightCounty(selectedCountyFips);
    } else {
      try {
        const url = new URL(window.location.href);
        const f = url.searchParams.get('fips');
        if (f) {
          selectState(f, { emit: true, push: false });
        }
      } catch {
        /* noop */
      }
    }
    syncCountyLayer();
    logMapProps();
  })();
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initMapClient, { once: true });
} else {
  initMapClient();
}


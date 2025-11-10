import {
  createDefaultModel,
  decode as decodeShare,
  encode as encodeShare,
  mergeModel,
} from '../lib/share.ts';

declare global {
  interface Window {
    __T1_SHARE__?: {
      version: string | null;
      getModel: () => ReturnType<typeof createDefaultModel>;
      setModel: (patch: Record<string, unknown>) => ReturnType<typeof createDefaultModel>;
      scheduleURLUpdate: (opts?: { delay?: number; push?: boolean; state?: unknown }) => void;
      encode: () => URL;
      flush: (opts?: { push?: boolean; state?: unknown }) => void;
    };
    __T1_SHARE_MODEL__?: ReturnType<typeof createDefaultModel>;
    __T1_SHARE_UTILS__?: {
      createDefaultModel: typeof createDefaultModel;
      mergeModel: typeof mergeModel;
      encode: typeof encodeShare;
    };
    __T1_PACK__?: { registry?: { pack_version?: string } };
    __t1_pack?: { registry?: { pack_version?: string } };
    __T1_PACK_VERSION__?: string | null;
  }
}

const win = typeof window !== 'undefined' ? window : undefined;

if (win) {
  const runSoon =
    typeof queueMicrotask === 'function'
      ? queueMicrotask.bind(window)
      : (fn: () => void) => window.setTimeout(fn, 0);

  const resolvePackVersion = (): string | null => {
    try {
      const seeded = win.__T1_PACK__ || win.__t1_pack;
      const version = seeded?.registry?.pack_version;
      if (typeof version === 'string' && version.trim()) return version;
    } catch (err) {
      try { console.warn('permalink: failed to resolve pack version', err); } catch (_) {}
    }
    return null;
  };

  const PACK_VERSION = win.__T1_PACK_VERSION__ || resolvePackVersion();
  win.__T1_PACK_VERSION__ = PACK_VERSION || null;

  const decodeCurrentLocation = () => {
    try {
      return decodeShare(win.location, { packVersion: PACK_VERSION || undefined });
    } catch (err) {
      try { console.warn('permalink: decode failed, using defaults', err); } catch (_) {}
      return createDefaultModel({ packVersion: PACK_VERSION || undefined });
    }
  };

  let model = win.__T1_SHARE_MODEL__ || decodeCurrentLocation();
  win.__T1_SHARE_MODEL__ = model;

  let timer = 0;

  const encodeCurrent = () =>
    encodeShare(model, {
      baseUrl: win.location.href,
      packVersion: PACK_VERSION || undefined,
    });

  const flush = ({ push = false, state }: { push?: boolean; state?: unknown } = {}) => {
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
      try { console.warn('permalink: flush failed', err); } catch (_) {}
    }
  };

  const scheduleURLUpdate = ({ delay = 150, push = false, state }: { delay?: number; push?: boolean; state?: unknown } = {}) => {
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

  const setModel = (patch: Record<string, unknown> = {}) => {
    try {
      model = mergeModel(model, patch, { packVersion: PACK_VERSION || undefined });
      win.__T1_SHARE_MODEL__ = model;
    } catch (err) {
      try { console.warn('permalink: merge failed', err); } catch (_) {}
    }
    return model;
  };

  const broadcast = (origin = 'permalink') => {
    try {
      const stateDetail =
        model.state && model.state.fips
          ? { fips: model.state.fips, code: model.state.code || null }
          : null;
      win.dispatchEvent(new CustomEvent('t1:state', { detail: stateDetail }));
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
      try { console.warn('permalink: broadcast failed', err); } catch (_) {}
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
      runSoon(() => broadcast('permalink-popstate'));
    } catch (err) {
      try { console.warn('permalink: popstate decode failed', err); } catch (_) {}
    }
  });
}


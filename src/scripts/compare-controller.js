const CONFIG_ID = 'compare-config';
const DEFAULT_STATE_LABEL = 'Select a state';
const DEFAULT_INPUTS = {
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
};
const DEFAULT_SCOPE = { local: false, state: true, federal: true };
const SCOPE_BITS = { local: 1, state: 2, federal: 4 };
const FILING_STATUS_MAP = {
  single: 'single',
  s: 'single',
  0: 'single',
  married: 'married',
  m: 'married',
  1: 'married',
  hoh: 'hoh',
  head: 'hoh',
  2: 'hoh',
};

const STATE_CODE_TO_FIPS = {
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
};

const NUMERIC_RE = /[^0-9.-]/g;

const currentURL = () => new URL(window.location.href);

const parseNumber = (value, fallback = 0) => {
  if (value == null) return fallback;
  const raw = String(value).trim();
  if (!raw) return fallback;
  const normalized = Number(raw.replace(NUMERIC_RE, ''));
  return Number.isFinite(normalized) ? normalized : fallback;
};

const parseShare = (value, fallback) => {
  const num = parseNumber(value, fallback);
  if (!Number.isFinite(num)) return fallback;
  if (Math.abs(num) > 1 && Math.abs(num) <= 100) return Math.max(0, Math.min(0.95, num / 100));
  return Math.max(0, Math.min(0.95, num));
};

const parseBool = (value, fallback) => {
  if (value == null || value === '') return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (!normalized) return fallback;
  if (normalized === '1' || normalized === 'true' || normalized === 'yes') return true;
  if (normalized === '0' || normalized === 'false' || normalized === 'no') return false;
  return fallback;
};

const normalizeZip = (value) => {
  if (value == null) return null;
  const digits = String(value).trim().replace(/\D+/g, '');
  if (!digits) return null;
  return digits.length >= 5 ? digits.slice(0, 5) : digits.padStart(5, '0');
};

const normalizeCountyFips = (value) => {
  if (value == null) return null;
  const digits = String(value).trim().replace(/\D+/g, '');
  if (!digits) return null;
  if (digits.length >= 5) return digits.slice(0, 5);
  if (digits.length <= 2) return digits.padStart(5, '0');
  return digits.padStart(5, '0');
};

const normalizeFilingStatus = (value) => {
  if (value == null) return DEFAULT_INPUTS.filingStatus;
  const key = String(value).trim().toLowerCase();
  return FILING_STATUS_MAP[key] || DEFAULT_INPUTS.filingStatus;
};

const maskToScope = (mask, fallback = DEFAULT_SCOPE) => {
  if (mask == null || mask === '') return { ...fallback };
  const numeric = Number(String(mask).replace(/[^0-9]/g, ''));
  if (!Number.isFinite(numeric)) return { ...fallback };
  return {
    local: (numeric & SCOPE_BITS.local) === SCOPE_BITS.local,
    state: (numeric & SCOPE_BITS.state) === SCOPE_BITS.state,
    federal: (numeric & SCOPE_BITS.federal) === SCOPE_BITS.federal,
  };
};

const readInputsFromURL = (u) => {
  try {
    const url = u instanceof URL ? u : new URL(String(u));
    const params = url.searchParams;
    const hasAny =
      ['fs', 'inc', 'own', 'ho', 'home', 'hv', 'miles', 'mi', 'mpg', 'sp', 'ss', 'tx', 'ts', 'fed', 'ltcg', 'sc', 'zip', 'cty'].some(
        (key) => params.has(key),
      );
    if (!hasAny) return null;
    const filingStatus = normalizeFilingStatus(params.get('fs'));
    const income = parseNumber(params.get('inc'), DEFAULT_INPUTS.income);
    const homeowner = parseBool(params.get('own') ?? params.get('ho'), DEFAULT_INPUTS.homeowner);
    const homeValue = parseNumber(params.get('home') ?? params.get('hv'), DEFAULT_INPUTS.homeValue);
    const miles = Math.max(0, Math.trunc(parseNumber(params.get('miles') ?? params.get('mi'), DEFAULT_INPUTS.miles)));
    const mpg = Math.max(1, Math.trunc(parseNumber(params.get('mpg'), DEFAULT_INPUTS.mpg)));
    const spendingShare = parseShare(params.get('sp') ?? params.get('ss'), DEFAULT_INPUTS.spendingShare);
    const taxableShare = parseShare(params.get('tx') ?? params.get('ts'), DEFAULT_INPUTS.taxableShare);
    const includeFederal = parseBool(params.get('fed'), DEFAULT_INPUTS.includeFederal);
    const ltcg = Math.max(0, Math.round(parseNumber(params.get('ltcg'), DEFAULT_INPUTS.ltcg)));
    const scopes = maskToScope(params.get('sc'));
    const locality = {
      zip: normalizeZip(params.get('zip')),
      countyFips: normalizeCountyFips(params.get('cty')),
    };
    return {
      filingStatus,
      income,
      homeowner,
      homeValue,
      miles,
      mpg,
      spendingShare,
      taxableShare,
      includeFederal,
      ltcg,
      scopes,
      locality,
    };
  } catch {
    return null;
  }
};

const buildCompareURL = (a, b, base = currentURL()) => {
  const url = base instanceof URL ? new URL(base.href) : currentURL();
  url.searchParams.set('a', (a || '').toUpperCase());
  url.searchParams.set('b', (b || '').toUpperCase());
  return url;
};

const linkToMainWithInputs = (stateCode, base = currentURL()) => {
  const url = new URL(base.href);
  url.pathname = '/';
  if (stateCode) {
    url.searchParams.set('state', stateCode.toUpperCase());
  } else {
    url.searchParams.delete('state');
  }
  url.searchParams.delete('a');
  url.searchParams.delete('b');
  return url;
};

const copyToClipboard = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
};

const ready = (fn) => {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fn, { once: true });
  } else {
    fn();
  }
};

const $ = (selector, root = document) => root.querySelector(selector);

function loadConfig() {
  try {
    const el = document.getElementById(CONFIG_ID);
    if (!el || !el.textContent) return null;
    const parsed = JSON.parse(el.textContent);
    return {
      stateLabels: parsed.stateLabels ?? {},
      leftDefault: (parsed.leftDefault || 'CA').toUpperCase(),
      rightDefault: (parsed.rightDefault || 'TX').toUpperCase(),
    };
  } catch (err) {
    console.warn('compare: failed to parse embedded config', err);
    return null;
  }
}

ready(() => {
  const config = loadConfig();
  if (!config) {
    console.warn('compare: missing configuration, aborting.');
    return;
  }
  initCompare(config);
});

function initCompare(config) {
  const STATE_LABELS = config.stateLabels;

  const labelFor = (code) => {
    if (!code) return DEFAULT_STATE_LABEL;
    const key = code.toUpperCase();
    return STATE_LABELS[key] || key || DEFAULT_STATE_LABEL;
  };

  let currentLeft = config.leftDefault;
  let currentRight = config.rightDefault;
  const actionsStatus = $('#compare-actions-status');

  const showActionStatus = (message) => {
    if (!actionsStatus) return;
    actionsStatus.textContent = message || '';
    actionsStatus.toggleAttribute('hidden', !message);
  };
  showActionStatus('');

  function getDefaults() {
    const url = currentURL();
    const qp = url.searchParams;
    return {
      left: (qp.get('a') || config.leftDefault).toUpperCase(),
      right: (qp.get('b') || config.rightDefault).toUpperCase(),
      url,
    };
  }

  function emitInputsFromURL(u) {
    let payload = null;
    try {
      payload = readInputsFromURL(u);
    } catch {
      payload = null;
    }
    if (!payload) return;
    queueMicrotask(() => {
      window.dispatchEvent(new CustomEvent('t1:inputs', { detail: payload }));
    });
  }

  (function normalizeGarbledText() {
    const swapBtn = $('#swap');
    if (swapBtn) swapBtn.textContent = 'Swap <->';
    const chipIds = ['#sum-left-total', '#sum-left-eff', '#sum-right-total', '#sum-right-eff'];
    for (const id of chipIds) {
      const el = $(id);
      if (el && (!el.textContent || /[^\w$%.\- ]/.test(el.textContent))) el.textContent = '--';
    }
    const head = $('#cmp-table thead tr');
    if (head && head.children && head.children.length >= 5) {
      head.children[3].textContent = 'Diff';
      head.children[4].textContent = 'Diff %';
    }
    const loading = $('#cmp-table tbody .loading td');
    if (loading) loading.textContent = 'Waiting for both sides...';
  })();

  let snapL = null;
  let snapR = null;
  let inputsContextState = null;

  const money = (n) => '$' + (Number(n || 0)).toLocaleString();
  const pct = (n) => `${((n || 0) * 100).toFixed(1)}%`;

  function unionKeys(a = [], b = []) {
    const keys = new Map();
    for (const r of a) keys.set(r.key, r.label);
    for (const r of b) if (!keys.has(r.key)) keys.set(r.key, r.label);
    const order = [
      'local_sales',
      'local_property',
      'local_services',
      'income',
      'sales',
      'property',
      'fed_income',
      'payroll',
      'ltcg',
    ];
    return Array.from(keys.entries()).sort((x, y) => {
      const ix = order.indexOf(x[0]);
      const iy = order.indexOf(y[0]);
      return (ix < 0 ? 99 : ix) - (iy < 0 ? 99 : iy);
    });
  }

  function renderCompare() {
    const tbody = $('#cmp-table tbody');
    if (!tbody) return;
    if (!snapL || !snapR) {
      tbody.innerHTML = '<tr class="loading"><td colspan="5">Waiting for both sides...</td></tr>';
      return;
    }

    const Ls = [...(snapL.rows.state || []), ...(snapL.rows.federal || [])];
    const Rs = [...(snapR.rows.state || []), ...(snapR.rows.federal || [])];
    const byKeyL = Object.fromEntries(Ls.map((r) => [r.key, r]));
    const byKeyR = Object.fromEntries(Rs.map((r) => [r.key, r]));
    const keys = unionKeys(Ls, Rs);

    const rows = [];
    for (const [key, label] of keys) {
      const lv = byKeyL[key]?.value ?? 0;
      const rv = byKeyR[key]?.value ?? 0;
      const diff = rv - lv;
      const diffPct = lv === 0 ? null : diff / lv;
      rows.push({
        label,
        left: lv ? money(lv) : '--',
        right: rv ? money(rv) : '--',
        diffClass: diff > 0 ? 'diff-neg' : diff < 0 ? 'diff-pos' : 'muted',
        diff: lv === 0 && rv === 0 ? '--' : money(diff),
        diffPct: diffPct == null ? '--' : `${(diffPct * 100).toFixed(1)}%`,
      });
    }

    const totals = {
      local: {
        left: snapL.totals.localSubtotal || 0,
        right: snapR.totals.localSubtotal || 0,
      },
      state: {
        left: snapL.totals.stateSubtotal || 0,
        right: snapR.totals.stateSubtotal || 0,
      },
      federal: {
        left: snapL.totals.federalSubtotal || 0,
        right: snapR.totals.federalSubtotal || 0,
      },
      total: {
        left: snapL.totals.total || 0,
        right: snapR.totals.total || 0,
      },
    };

    const pushRow = (label, lv, rv) => {
      const diff = rv - lv;
      const dp = lv === 0 ? null : diff / lv;
      rows.push({
        label,
        left: money(lv),
        right: money(rv),
        diffClass: diff > 0 ? 'diff-neg' : diff < 0 ? 'diff-pos' : 'muted',
        diff: money(diff),
        diffPct: dp == null ? '--' : `${(dp * 100).toFixed(1)}%`,
      });
    };

    if ((snapL.rows.local?.length || 0) || (snapR.rows.local?.length || 0)) {
      pushRow('Local subtotal', totals.local.left, totals.local.right);
    }
    pushRow('State subtotal', totals.state.left, totals.state.right);
    if (snapL.inputs?.includeFederal || snapR.inputs?.includeFederal) {
      pushRow('Federal subtotal', totals.federal.left, totals.federal.right);
    }
    pushRow('Total', totals.total.left, totals.total.right);

    tbody.innerHTML = rows
      .map(
        (r) => `
          <tr>
            <td>${r.label}</td>
            <td class="text-right">${r.left}</td>
            <td class="text-right">${r.right}</td>
            <td class="text-right ${r.diffClass}">${r.diff}</td>
            <td class="text-right ${r.diffClass}">${r.diffPct}</td>
          </tr>
        `,
      )
      .join('');

    const lt = snapL.totals.total || 0;
    const rt = snapR.totals.total || 0;
    const dt = rt - lt;
    const dp = lt === 0 ? null : dt / lt;

    const diffClass = dt > 0 ? 'diff-neg' : dt < 0 ? 'diff-pos' : '';
    const leftTotalEl = $('#cmp-left-total');
    const rightTotalEl = $('#cmp-right-total');
    const diffEl = $('#cmp-diff-total');
    const diffPctEl = $('#cmp-diffpct-total');

    if (leftTotalEl) leftTotalEl.textContent = money(lt);
    if (rightTotalEl) rightTotalEl.textContent = money(rt);
    if (diffEl) {
      diffEl.textContent = money(dt);
      diffEl.className = `text-right ${diffClass}`;
    }
    if (diffPctEl) {
      diffPctEl.textContent = dp == null ? '--' : `${(dp * 100).toFixed(1)}%`;
      diffPctEl.className = `text-right ${diffClass}`;
    }

    const sumLeftTotal = $('#sum-left-total');
    const sumLeftEff = $('#sum-left-eff');
    const sumRightTotal = $('#sum-right-total');
    const sumRightEff = $('#sum-right-eff');

    if (sumLeftTotal) sumLeftTotal.textContent = money(lt);
    if (sumLeftEff) sumLeftEff.textContent = pct(snapL.totals.effectiveRate);
    if (sumRightTotal) sumRightTotal.textContent = money(rt);
    if (sumRightEff) sumRightEff.textContent = pct(snapR.totals.effectiveRate);
  }

  document.addEventListener('t1:breakdown-computed', (event) => {
    const detail = (event && event.detail) || {};
    if (detail.slot === 'left') snapL = detail;
    if (detail.slot === 'right') snapR = detail;
    renderCompare();
  });

  function setPanelLabels(left, right) {
    currentLeft = left;
    currentRight = right;
    const leftName = labelFor(left);
    const rightName = labelFor(right);
    const leftLabel = $('#compare-left-label');
    const rightLabel = $('#compare-right-label');
    if (leftLabel) {
      leftLabel.textContent = leftName;
      leftLabel.setAttribute('data-code', left);
    }
    if (rightLabel) {
      rightLabel.textContent = rightName;
      rightLabel.setAttribute('data-code', right);
    }
    const toolbarLeft = $('#toolbar-left-label');
    const toolbarRight = $('#toolbar-right-label');
    if (toolbarLeft) {
      toolbarLeft.textContent = leftName;
      toolbarLeft.setAttribute('title', leftName);
    }
    if (toolbarRight) {
      toolbarRight.textContent = rightName;
      toolbarRight.setAttribute('title', rightName);
    }
    const cmpColLeft = $('#cmp-col-left');
    const cmpColRight = $('#cmp-col-right');
    if (cmpColLeft) cmpColLeft.textContent = leftName;
    if (cmpColRight) cmpColRight.textContent = rightName;
  }

  function syncAll({ pushHistory = false } = {}) {
    const u = currentURL();
    const leftSel = document.querySelector('#sel-left');
    const rightSel = document.querySelector('#sel-right');
    const left = (leftSel?.value || config.leftDefault).toUpperCase();
    const right = (rightSel?.value || config.rightDefault).toUpperCase();
    setPanelLabels(left, right);

    const nu = buildCompareURL(left, right, u);
    if (pushHistory && typeof history.replaceState === 'function') {
      history.replaceState({}, '', nu.toString());
    }

    const mainURL = linkToMainWithInputs(left, nu);
    const openMain = $('#open-main');
    if (openMain) openMain.href = mainURL.toString();

    window.dispatchEvent(new CustomEvent('t1:state-left', { detail: left }));
    window.dispatchEvent(new CustomEvent('t1:state-right', { detail: right }));

    const nextContext =
      inputsContextState && (inputsContextState === left || inputsContextState === right)
        ? inputsContextState
        : left;
    inputsContextState = (nextContext || left || '').toUpperCase();
    const normalized = inputsContextState || null;
    const stateFips = normalized ? STATE_CODE_TO_FIPS[normalized] || null : null;
    const detail = normalized
      ? {
          code: normalized,
          geoSelection: { layer: 'state', stateFips, countyFips: null },
        }
      : null;
    const ctrl = typeof window !== 'undefined' ? window.__T1_CONTROLLER__ : null;
    if (ctrl && typeof ctrl.setGeoSelection === 'function') {
      ctrl.setGeoSelection(
        { stateCode: normalized, countyFips: null },
        { emit: false, schedule: false },
      );
    }
    window.dispatchEvent(new CustomEvent('t1:state', { detail }));
  }

  const leftSel = document.querySelector('#sel-left');
  const rightSel = document.querySelector('#sel-right');
  const swapBtn = document.querySelector('#swap');

  leftSel?.addEventListener('change', () => {
    inputsContextState = (leftSel.value || '').toUpperCase() || inputsContextState;
    syncAll({ pushHistory: true });
  });

  rightSel?.addEventListener('change', () => {
    inputsContextState = (rightSel.value || '').toUpperCase() || inputsContextState;
    syncAll({ pushHistory: true });
  });

  swapBtn?.addEventListener('click', () => {
    if (leftSel && rightSel) {
      const tmp = leftSel.value;
      leftSel.value = rightSel.value;
      rightSel.value = tmp;
      syncAll({ pushHistory: true });
    }
  });

  window.addEventListener('popstate', () => {
    const { left, right, url } = getDefaults();
    if (leftSel) leftSel.value = left;
    if (rightSel) rightSel.value = right;
    emitInputsFromURL(url);
    syncAll();
  });

  (function init() {
    const { left, right, url } = getDefaults();
    if (leftSel) leftSel.value = left;
    if (rightSel) rightSel.value = right;
    emitInputsFromURL(url);
    syncAll({ pushHistory: true });
  })();

  window.addEventListener('t1:inputs', () => {
    // snapshots update via events dispatched from Breakdown panels
  });

  const ACTION_HANDLERS = {
    export: () => {
      const states = [currentLeft, currentRight].filter(Boolean);
      const unique = Array.from(new Set(states));
      if (!unique.length) {
        showActionStatus('Select states to export.');
        return;
      }
      unique.forEach((code, idx) => {
        window.setTimeout(() => {
          window.open(`/report?state=${code}`, '_blank', 'noopener');
        }, idx * 150);
      });
      showActionStatus('PDF export opened in new tabs.');
    },
    copy: async () => {
      const ok = await copyToClipboard(currentURL().toString());
      showActionStatus(ok ? 'Comparison link copied.' : 'Copy failed.');
    },
    chart: () => {
      const entries = [
        { slot: 'left', summary: snapL?.chartSummary, label: labelFor(currentLeft) },
        { slot: 'right', summary: snapR?.chartSummary, label: labelFor(currentRight) },
      ];
      if (!entries.some((entry) => entry.summary)) {
        showActionStatus('Load at least one state to view charts.');
        return;
      }
      const builder = typeof window !== 'undefined' ? window.__T1_BUILD_CHART__ : null;
      const initChart = typeof window !== 'undefined' ? window.__T1_INIT_CHART__ : null;
      if (typeof builder !== 'function' || typeof initChart !== 'function') {
        showActionStatus('Charts unavailable. Refresh and try again.');
        return;
      }
      const panels = [];
      const initQueue = [];
      let panelCount = 0;
      entries.forEach((entry) => {
        if (panelCount > 0) {
          panels.push('<div class="compare-chart-modal__divider" aria-hidden="true"></div>');
        }
        const label = entry.label && entry.label !== DEFAULT_STATE_LABEL ? entry.label : 'State';
        if (!entry.summary) {
          panels.push(
            `<section class="compare-chart-modal__panel compare-chart-modal__panel--empty"><p>No data yet for ${label}.</p></section>`,
          );
          panelCount += 1;
          return;
        }
        panels.push(
          `<section class="compare-chart-modal__panel" data-chart-slot="${entry.slot}">
            <h3 class="chart-modal__panel-title">${label}</h3>
            ${builder(entry.summary)}
          </section>`,
        );
        initQueue.push({ slot: entry.slot, summary: entry.summary });
        panelCount += 1;
      });
      const html = `<div class="compare-chart-modal">${panels.join('')}</div>`;
      window.dispatchEvent(
        new CustomEvent('t1:modal-open', { detail: { title: 'Comparison charts', html } }),
      );
      requestAnimationFrame(() => {
        const modalBody = document.getElementById('t1-modal-body');
        initQueue.forEach(({ slot, summary }) => {
          if (!modalBody) return;
          const root = modalBody.querySelector(
            `.compare-chart-modal__panel[data-chart-slot="${slot}"] .chart-modal[data-chart-modal]`,
          );
          if (root) {
            try {
              initChart(summary, root);
            } catch (err) {
              console.warn('compare: chart init failed', err);
            }
          }
        });
      });
    },
  };

  document.querySelectorAll('[data-action-btn]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const action = btn.getAttribute('data-action');
      if (!action || !ACTION_HANDLERS[action]) return;
      try {
        await ACTION_HANDLERS[action]();
      } catch {
        showActionStatus('Action failed. Try again.');
      }
    });
  });

}

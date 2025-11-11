import {
  currentURL,
  readInputsFromURL,
  buildCompareURL,
  linkToMainWithInputs,
  copyToClipboard,
} from '../lib/url/share.ts';

const CONFIG_ID = 'compare-config';
const DEFAULT_STATE_LABEL = 'Select a state';

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
    inputsContextState = nextContext || left;
    const detail = inputsContextState ? { code: inputsContextState } : null;
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
      if (!snapL && !snapR) {
        showActionStatus('Load at least one state to view charts.');
        return;
      }
      const html = buildCompareChartHTML();
      window.dispatchEvent(
        new CustomEvent('t1:modal-open', { detail: { title: 'Comparison charts', html } }),
      );
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

  function buildCompareChartHTML() {
    const sections = [renderChartPanel(labelFor(currentLeft), snapL), renderChartPanel(labelFor(currentRight), snapR)];
    return `<div class="compare-chart">${sections.join('')}</div>`;
  }

  function renderChartPanel(label, snap) {
    const hasLabel = label && label !== DEFAULT_STATE_LABEL;
    if (!snap) {
      const msg = hasLabel ? `No data yet for ${label}.` : 'No data yet.';
      return `<div class="compare-chart__panel compare-chart__panel--empty"><p>${msg}</p></div>`;
    }
    const segments = [
      { key: 'local', label: 'Local', value: snap.totals.localSubtotal || 0, color: 'var(--scope-local)' },
      { key: 'state', label: 'State', value: snap.totals.stateSubtotal || 0, color: 'var(--scope-state)' },
      { key: 'federal', label: 'Federal', value: snap.totals.federalSubtotal || 0, color: 'var(--scope-federal)' },
    ];
    const total = segments.reduce((sum, seg) => sum + seg.value, 0) || 1;
    const bar = segments
      .map((seg) => {
        if (!seg.value) return '';
        const width = Math.max(1, (seg.value / total) * 100);
        return `<span style="width:${width}%;background:${seg.color}" aria-label="${seg.label} ${money(
          seg.value,
        )}"></span>`;
      })
      .join('');
    const legend = segments
      .map(
        (seg) =>
          `<li><span><span class="color-dot" style="background:${seg.color}"></span>${seg.label}</span><span>${money(
            seg.value,
          )} · ${pct(seg.value / total)}</span></li>`,
      )
      .join('');
    return `
      <div class="compare-chart__panel">
        <header>
          <strong>${label}</strong>
          <span>${money(total)}</span>
        </header>
        <div class="compare-chart__bar">${bar || '<span class="empty-bar"></span>'}</div>
        <ul class="compare-chart__legend">${legend}</ul>
      </div>
    `;
  }
}

import { normalizeLocalScope } from './local-shape.ts';

type ScopeKey = 'local' | 'state' | 'federal';

const bootInputsClient = () => {
  try {
    const selectorRoot = document.querySelector('[data-component="scope-selector"]');
    const scopeButtons = selectorRoot ? Array.from(selectorRoot.querySelectorAll<HTMLButtonElement>('button[data-scope]')) : [];
    const scopeState: Record<ScopeKey, boolean> = {
      local: scopeButtons.some((btn) => btn.dataset.scope === 'local' && btn.classList.contains('is-active')),
      state: scopeButtons.some((btn) => btn.dataset.scope === 'state') ? true : true,
      federal: scopeButtons.some((btn) => btn.dataset.scope === 'federal') ? true : true,
    };

    // Ensure normalizeLocalScope is executed once so downstream controllers relying on it behave.
    normalizeLocalScope({}, { enabled: scopeState.local });

    const broadcastScope = () => {
      window.dispatchEvent(
        new CustomEvent('t1:scope-changed', {
          detail: { ...scopeState, __origin: 'inputs-client' },
        }),
      );
    };

    scopeButtons.forEach((button) => {
      const scope = button.dataset.scope as ScopeKey | undefined;
      if (!scope) return;
      button.addEventListener('click', () => {
        scopeState[scope] = !scopeState[scope];
        button.classList.toggle('is-active', scopeState[scope]);
        button.setAttribute('aria-pressed', scopeState[scope] ? 'true' : 'false');
        broadcastScope();
      });
    });

    broadcastScope();
  } catch (err) {
    console.warn('inputs-client bootstrap failed', err);
  }
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootInputsClient, { once: true });
} else {
  bootInputsClient();
}

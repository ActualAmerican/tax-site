// Lightweight, privacy‑respecting analytics helper.
// Usage: track('copy_link', { page: 'compare' })
export function track(event: string, data: Record<string, any> = {}) {
  try {
    const enabled = (window as any).__T1_ANALYTICS__ !== 'off';
    if (!enabled) return;
    const payload = {
      ev: event,
      ts: Date.now(),
      href: location.href,
      ...data,
    };
    const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
    if (navigator.sendBeacon) navigator.sendBeacon('/analytics', blob);
    // Fallback to console for dev
    else console.debug('[analytics]', payload);
  } catch {}
}


// T1 — US map renderer (bundled by Vite via Astro.resolve)
import { geoAlbersUsa, geoPath } from "d3-geo";
import { feature, mesh } from "topojson-client";

const root = document.querySelector<HTMLElement>("[data-t1-map]");
if (!root) {
  // Not on this page — do nothing
} else {
  const svg = root.querySelector<SVGSVGElement>("svg")!;
  const g = svg.querySelector<SVGGElement>("g")!;
  // --- Selection & deep-link helpers ---
  let selectedFips: string | null = null;

  function selectState(
    fips: string,
    opts: { emit?: boolean; push?: boolean } = {}
  ) {
    const { emit = true, push = false } = opts;

    // Toggle CSS class
    if (selectedFips) {
      const prev = svg.querySelector<SVGPathElement>(
        `.state[data-fips="${selectedFips}"]`
      );
      if (prev) prev.classList.remove("state--selected");
    }
    const next = svg.querySelector<SVGPathElement>(
      `.state[data-fips="${fips}"]`
    );
    if (next) next.classList.add("state--selected");
    selectedFips = fips;

    // Update URL (?fips=XX)
    try {
      const url = new URL(location.href);
      url.searchParams.set("fips", fips);
      if (push) history.pushState({ fips }, "", url);
      else history.replaceState({ fips }, "", url);
    } catch {}

    // Notify listeners
    if (emit) {
      window.dispatchEvent(new CustomEvent("t1:state", { detail: fips }));
    }
  }

  // Apply selection from URL on load
  (function applyInitialSelection() {
    try {
      const url = new URL(location.href);
      const f = url.searchParams.get("fips");
      if (f) selectState(f, { emit: true, push: false });
    } catch {}
  })();

  // React to back/forward
  window.addEventListener("popstate", (e: PopStateEvent) => {
    const f =
      (e.state && (e.state as any).fips) ||
      (() => {
        try {
          return new URL(location.href).searchParams.get("fips");
        } catch {
          return null;
        }
      })();
    if (f) selectState(f, { emit: true, push: false });
  });

  let topoCache: any = null;

  async function loadTopo() {
    if (topoCache) return topoCache;
    const res = await fetch("/topo/states-10m.json");
    topoCache = await res.json();
    return topoCache;
  }

  async function render() {
    const topo = await loadTopo();
    const states = feature(topo, topo.objects.states);
    const nation = mesh(topo, topo.objects.nation, (a: any, b: any) => a === b);

    const width = root.clientWidth || 960;
    const height = 520;

    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);

    const projection = geoAlbersUsa().fitSize([width, height], states as any);
    const path = geoPath(projection);

    g.innerHTML = "";

    // Draw states
    for (const f of (states as any).features) {
      const fips = String(f.id);
      const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
      p.setAttribute("d", path(f)!);
      p.setAttribute("data-fips", fips);
      p.setAttribute("class", "state");
      p.addEventListener("click", () =>
        selectState(fips, { emit: true, push: true })
      );
      g.appendChild(p);
    }

    // National outline overlay
    if (nation) {
      const outline = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "path"
      );
      outline.setAttribute("d", path(nation as any)!);
      outline.setAttribute("class", "nation");
      g.appendChild(outline);
    }
  }
  // Re-apply highlight after re-render (resize etc.)
  if (selectedFips) {
    const s = svg.querySelector<SVGPathElement>(
      `.state[data-fips="${selectedFips}"]`
    );
    if (s) s.classList.add("state--selected");
  }
  render();
  addEventListener("resize", render);
}

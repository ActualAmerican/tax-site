// T1 — US map renderer (bundled by Vite via Astro.resolve)
import { geoAlbersUsa, geoPath } from "d3-geo";
import { feature, mesh } from "topojson-client";

const root = document.querySelector<HTMLElement>("[data-t1-map]");
if (!root) {
  // Not on this page — bail out.
  // (No-op; just return from the module body.)
} else {
  const svg = root.querySelector<SVGSVGElement>("svg")!;
  const g = svg.querySelector<SVGGElement>("g")!;

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
      const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
      p.setAttribute("d", path(f)!);
      p.setAttribute("data-fips", f.id);
      p.setAttribute("class", "state");
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

  render();
  addEventListener("resize", render);
}

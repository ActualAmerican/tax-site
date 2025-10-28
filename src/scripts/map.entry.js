// Map client entry — bundled by Vite into a runnable JS module.
import { geoAlbersUsa, geoPath } from "d3-geo";
import { feature, mesh } from "topojson-client";

const root = document.querySelector("[data-t1-map]");
if (!root) {
  // Not on this page — bail out.
} else {
  const svg = root.querySelector("svg");
  const g = svg.querySelector("g");

  let topoCache = null;

  async function loadTopo() {
    if (topoCache) return topoCache;
    const res = await fetch("/topo/states-10m.json");
    topoCache = await res.json();
    return topoCache;
  }

  async function render() {
    const topo = await loadTopo();
    const states = feature(topo, topo.objects.states);
    const nation = mesh(topo, topo.objects.nation, (a, b) => a === b);

    const width = root.clientWidth || 960;
    const height = 520;

    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);

    const projection = geoAlbersUsa().fitSize([width, height], states);
    const path = geoPath(projection);

    g.innerHTML = "";

    // Draw states
    for (const f of states.features) {
      const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
      p.setAttribute("d", path(f));
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
      outline.setAttribute("d", path(nation));
      outline.setAttribute("class", "nation");
      g.appendChild(outline);
    }
  }

  render();
  addEventListener("resize", render);
}

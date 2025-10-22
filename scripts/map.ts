import { geoAlbersUsa, geoPath } from "d3-geo";
import { feature } from "topojson-client";

const id2abbr: Record<string, string> = {
  "01": "AL",
  "02": "AK",
  "04": "AZ",
  "05": "AR",
  "06": "CA",
  "08": "CO",
  "09": "CT",
  "10": "DE",
  "11": "DC",
  "12": "FL",
  "13": "GA",
  "15": "HI",
  "16": "ID",
  "17": "IL",
  "18": "IN",
  "19": "IA",
  "20": "KS",
  "21": "KY",
  "22": "LA",
  "23": "ME",
  "24": "MD",
  "25": "MA",
  "26": "MI",
  "27": "MN",
  "28": "MS",
  "29": "MO",
  "30": "MT",
  "31": "NE",
  "32": "NV",
  "33": "NH",
  "34": "NJ",
  "35": "NM",
  "36": "NY",
  "37": "NC",
  "38": "ND",
  "39": "OH",
  "40": "OK",
  "41": "OR",
  "42": "PA",
  "44": "RI",
  "45": "SC",
  "46": "SD",
  "47": "TN",
  "48": "TX",
  "49": "UT",
  "50": "VT",
  "51": "VA",
  "53": "WA",
  "54": "WV",
  "55": "WI",
  "56": "WY",
};

let topoPromise: Promise<any> | null = null;
function loadTopo() {
  if (!topoPromise) {
    topoPromise = fetch("/topo/states-10m.json").then((r) => r.json());
  }
  return topoPromise;
}

function emit(code: string, evt?: MouseEvent | KeyboardEvent) {
  if (evt && ("metaKey" in evt || "ctrlKey" in evt)) {
    const m = evt as MouseEvent;
    if (m.metaKey || m.ctrlKey || (m as any).button === 1) {
      window.open("/state/" + code, "_blank", "noopener");
      return;
    }
  }
  window.dispatchEvent(new CustomEvent("t1:state-solo", { detail: code }));
}

async function init(el: HTMLElement) {
  const svg = el.querySelector("svg") as SVGSVGElement;
  const g = svg.querySelector("g") as SVGGElement;

  // stable viewBox so first paint never collapses to 0×0
  const height = 520;
  svg.setAttribute("viewBox", "0 0 960 520");

  const topo = await loadTopo();
  const states = feature(topo, topo.objects.states).features as any[];

  const projection = geoAlbersUsa()
    .translate([480, height / 2])
    .scale(1000);
  const path = geoPath(projection as any);

  g.innerHTML = ""; // reset
  for (const f of states) {
    const code = id2abbr[String((f as any).id)] || "CA";
    const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
    p.setAttribute("d", path(f as any) as string);
    p.setAttribute("fill", "#0c121a");
    p.setAttribute("stroke", "#1f2a37");
    p.setAttribute("data-code", code);
    p.setAttribute("role", "button");
    p.setAttribute("tabindex", "0");
    p.setAttribute("aria-label", "Select state " + code);
    (p as any).style.cursor = "pointer";

    p.addEventListener("click", (e) => emit(code, e));
    p.addEventListener("auxclick", (e) => emit(code, e)); // middle click
    p.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        emit(code, e);
      }
      if (
        (e.ctrlKey || (e as any).metaKey) &&
        (e.key === "Enter" || e.key === " ")
      ) {
        window.open("/state/" + code, "_blank", "noopener");
      }
    });

    p.addEventListener("mouseenter", () => p.setAttribute("fill", "#111a24"));
    p.addEventListener("mouseleave", () => p.setAttribute("fill", "#0c121a"));
    p.addEventListener("focus", () => p.setAttribute("stroke", "#60a5fa"));
    p.addEventListener("blur", () => p.setAttribute("stroke", "#1f2a37"));

    g.appendChild(p);
  }
}

function boot() {
  document.querySelectorAll<HTMLElement>("[data-t1-map]").forEach(init);
}
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}

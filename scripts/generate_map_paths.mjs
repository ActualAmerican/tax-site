import fs from "fs";
import path from "path";
import { feature, mesh } from "topojson-client";
import { geoAlbersUsa, geoPath } from "d3-geo";

const topoPath = path.resolve(
  process.cwd(),
  "public",
  "topo",
  "states-10m.json"
);
const txt = fs.readFileSync(topoPath, "utf-8");
const topo = JSON.parse(txt);
const states = feature(topo, topo.objects.states);
const nation = mesh(topo, topo.objects.nation, (a, b) => a === b);
const width = 960,
  height = 520;
const projection = geoAlbersUsa().fitSize([width, height], states);
const pathGen = geoPath(projection);

const parts = [];
for (const f of states.features) {
  const d = pathGen(f);
  parts.push(`<path d="${d}" data-fips="${f.id}" class="state"></path>`);
}
if (nation) parts.push(`<path d="${pathGen(nation)}" class="nation"></path>`);

const outPath = path.resolve(
  process.cwd(),
  "src",
  "components",
  "map.paths.html"
);
fs.writeFileSync(outPath, parts.join("\n"));
console.log("Wrote", outPath);

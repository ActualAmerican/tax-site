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
console.log("features:", (states.features || []).length);
console.log("nation exists:", Boolean(nation));
console.log("sample d length:", pathGen(states.features[0]).length);

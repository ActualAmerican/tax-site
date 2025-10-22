// src/pages/data/pack.json.ts
// Serves the current data pack at /data/pack.json
import pack from "../../../data/packs/2025.1.0.json";

export const prerender = true;

export async function GET() {
  return new Response(JSON.stringify(pack), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=0, must-revalidate",
    },
  });
}

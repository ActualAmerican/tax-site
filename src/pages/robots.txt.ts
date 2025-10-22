export const prerender = true;
export async function GET() {
  return new Response(
    `User-agent: *
Allow: /
Sitemap: https://example.com/sitemap.xml
`,
    { headers: { "Content-Type": "text/plain" } }
  );
}

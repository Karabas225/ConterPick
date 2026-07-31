const icon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#8af1d4"/><path d="M14 16h36v25L41 50H14z" fill="#071219"/><path d="M21 24h22v6H21zm0 10h14v6H21z" fill="#8af1d4"/></svg>`;

export function GET() {
  return new Response(icon, { headers: { "content-type": "image/svg+xml; charset=utf-8", "cache-control": "public, max-age=86400" } });
}

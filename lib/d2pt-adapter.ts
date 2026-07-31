const ALLOWED = [/^\/meta(?:\?.*)?$/, /^\/combos(?:\?.*)?$/, /^\/builds(?:\?.*)?$/, /^\/hero\/[A-Za-z0-9%_'-]+(?:\?.*)?$/];

export function isAllowedD2ptPath(pathname: string) { return ALLOWED.some((pattern) => pattern.test(pathname)); }
export async function fetchD2ptPage(pathname: string) {
  if (!isAllowedD2ptPath(pathname)) throw new Error("D2PT path is not allowlisted");
  const env = (globalThis as typeof globalThis & { process?: { env?: Record<string, string> } }).process?.env;
  if (env?.D2PT_SCRAPING_ENABLED !== "true") return null;
  const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 9000);
  try {
    const response = await fetch("https://dota2protracker.com" + pathname, { headers: { "user-agent": env.D2PT_USER_AGENT ?? "CounterPick/1.0 (authorized D2PT integration)" }, signal: controller.signal });
    if (!response.ok) throw new Error("D2PT returned " + response.status);
    return await response.text();
  } finally { clearTimeout(timeout); }
}
export function parseMetaSnapshot(html: string) {
  const rows: { name: string; matches: number; winRate: number }[] = [];
  const pattern = /([A-Z][A-Za-z' -]{2,})\s+Win Rate:\s*([\d.]+)%\s+Matches:\s*([\d,]+)/g;
  for (const match of html.matchAll(pattern)) rows.push({ name: match[1].trim(), winRate: Number(match[2]), matches: Number(match[3].replace(/,/g, "")) });
  return rows;
}

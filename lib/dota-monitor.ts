import { asIso, asNumber, storeFirst, storeRun } from "./app-store";
import { CATALOG, PATCH } from "./dota-data";

const VALVE_PATCHES_URL = "https://www.dota2.com/datafeed/patchnoteslist?language=english";
const STEAM_NEWS_URL = "https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=570&count=50&maxlength=2000";
const OPENDOTA_HERO_STATS_URL = "https://api.opendota.com/api/heroStats";
const D2PT_META_URL = "https://dota2protracker.com/meta";
const D2PT_BUILDS_URL = "https://dota2protracker.com/builds";
const SOURCE_URL = `${VALVE_PATCHES_URL} · ${STEAM_NEWS_URL} · ${OPENDOTA_HERO_STATS_URL}`;
const REFRESH_MS = 24 * 60 * 60 * 1000;
const ERROR_RETRY_MS = 15 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 12_000;

export type HeroMetaSnapshot = { matches: number; winRate: number };
export type BuildSnapshot = {
  heroId: number;
  role: number;
  sample: number;
  starting: string[];
  early: string[];
  core: { item: string; timing: string }[];
  situational: { item: string; reason: string; lift?: string }[];
  skills: string[];
  talents: { level: number; text: string }[];
  source?: string;
};
export type DotaUpdateSnapshot = {
  patch: string;
  checkedAt: string | null;
  sourceUpdatedAt: string | null;
  dataUpdatedAt: string | null;
  buildsUpdatedAt: string | null;
  status: "ok" | "stale" | "error" | "unknown";
  buildsStatus: "fresh" | "fallback" | "stale" | "error";
  source: string;
  lastError: string | null;
  heroStats: Record<string, HeroMetaSnapshot>;
  builds: Record<string, BuildSnapshot>;
};

type SteamNewsItem = { title?: string; contents?: string; date?: number; url?: string };
type UpdateRow = { current_patch: string; checked_at: unknown; source_updated_at: unknown; status: string; source: string; payload?: unknown };

function runtimeEnv(key: string) {
  const processEnv = (globalThis as typeof globalThis & { process?: { env?: Record<string, string> } }).process?.env;
  return processEnv?.[key];
}

function parsePayload(payload: unknown): { heroStats: Record<string, HeroMetaSnapshot>; builds: Record<string, BuildSnapshot>; dataUpdatedAt: string | null; buildsUpdatedAt: string | null; buildsStatus: DotaUpdateSnapshot["buildsStatus"]; lastError: string | null } {
  if (typeof payload !== "string") return { heroStats: {}, builds: {}, dataUpdatedAt: null, buildsUpdatedAt: null, buildsStatus: "fallback", lastError: null };
  try {
    const parsed = JSON.parse(payload) as Record<string, unknown>;
    const heroStats = parsed.heroStats && typeof parsed.heroStats === "object" ? parsed.heroStats as Record<string, HeroMetaSnapshot> : {};
    const builds = parsed.builds && typeof parsed.builds === "object" ? parsed.builds as Record<string, BuildSnapshot> : {};
    return {
      heroStats,
      builds,
      dataUpdatedAt: typeof parsed.dataUpdatedAt === "string" ? parsed.dataUpdatedAt : null,
      buildsUpdatedAt: typeof parsed.buildsUpdatedAt === "string" ? parsed.buildsUpdatedAt : null,
      buildsStatus: parsed.buildsStatus === "fresh" || parsed.buildsStatus === "stale" || parsed.buildsStatus === "error" ? parsed.buildsStatus : "fallback",
      lastError: typeof parsed.lastError === "string" ? parsed.lastError : null,
    };
  } catch {
    return { heroStats: {}, builds: {}, dataUpdatedAt: null, buildsUpdatedAt: null, buildsStatus: "fallback", lastError: null };
  }
}

function rowToSnapshot(row: UpdateRow | undefined): DotaUpdateSnapshot {
  const parsed = parsePayload(row?.payload);
  return {
    patch: row?.current_patch ?? PATCH,
    checkedAt: asIso(row?.checked_at),
    sourceUpdatedAt: asIso(row?.source_updated_at),
    dataUpdatedAt: parsed.dataUpdatedAt,
    buildsUpdatedAt: parsed.buildsUpdatedAt,
    status: (row?.status as DotaUpdateSnapshot["status"]) ?? "unknown",
    buildsStatus: parsed.buildsStatus,
    lastError: parsed.lastError,
    source: row?.source ?? SOURCE_URL,
    heroStats: parsed.heroStats,
    builds: parsed.builds,
  };
}

async function readRow() {
  try {
    return await storeFirst<UpdateRow>("SELECT current_patch, checked_at, source_updated_at, status, source, payload FROM dota_updates WHERE id = 1 LIMIT 1");
  } catch {
    return undefined;
  }
}

async function persist(snapshot: { patch: string; status: string; payload: string; sourceUpdatedAt?: Date | null; source?: string }) {
  try {
    const now = Date.now();
    const sourceUpdatedAt = snapshot.sourceUpdatedAt?.getTime() ?? null;
    const source = snapshot.source ?? SOURCE_URL;
    const existing = await readRow();
    if (existing) await storeRun("UPDATE dota_updates SET source = ?, current_patch = ?, status = ?, payload = ?, checked_at = ?, source_updated_at = ? WHERE id = 1", [source, snapshot.patch, snapshot.status, snapshot.payload, now, sourceUpdatedAt]);
    else await storeRun("INSERT INTO dota_updates (id, source, current_patch, status, payload, checked_at, source_updated_at) VALUES (1, ?, ?, ?, ?, ?, ?)", [source, snapshot.patch, snapshot.status, snapshot.payload, now, sourceUpdatedAt]);
  } catch {
    // Preview and statically rendered pages can run without a configured database.
  }
}

async function fetchJson<T>(url: string): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, { headers: { accept: "application/json", "user-agent": "CounterPick/1.0" }, signal: controller.signal });
    if (!response.ok) throw new Error(`Source returned ${response.status}`);
    return await response.json() as T;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchText(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, { headers: { accept: "text/html", "user-agent": "CounterPick/1.0 (authorized non-commercial use)" }, signal: controller.signal });
    if (!response.ok) throw new Error(`Source returned ${response.status}`);
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

function patchFromNews(items: SteamNewsItem[]) {
  const patchPattern = /\b(7\.\d{1,3}[a-z]?)\b/i;
  const sorted = [...items].sort((a, b) => (b.date ?? 0) - (a.date ?? 0));
  for (const item of sorted) {
    const match = `${item.title ?? ""} ${item.contents ?? ""}`.match(patchPattern);
    if (match?.[1]) return { patch: match[1], date: item.date ? new Date(item.date * 1000) : null };
  }
  return { patch: null, date: null };
}

type ValvePatchRow = { patch_number?: string; patch_name?: string; patch_timestamp?: number | string; timestamp?: number | string };

function patchFromValve(input: unknown) {
  const rows = input && typeof input === "object" && Array.isArray((input as { patches?: unknown }).patches) ? (input as { patches: ValvePatchRow[] }).patches : [];
  const parsed = rows.map((row) => {
    const patch = typeof row.patch_number === "string" ? row.patch_number : typeof row.patch_name === "string" ? row.patch_name : "";
    const rawDate = row.patch_timestamp ?? row.timestamp;
    const timestamp = typeof rawDate === "number" ? rawDate : Number(rawDate);
    return { patch, date: Number.isFinite(timestamp) && timestamp > 0 ? new Date(timestamp * 1000) : null };
  }).filter((row) => /^7\.\d{1,3}[a-z]?$/i.test(row.patch));
  parsed.sort((a, b) => (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0));
  return parsed[0] ?? { patch: null, date: null };
}

function patchFromText(input: string) {
  const match = input.match(/\b(7\.\d{1,3}[a-z]?)\b/i);
  return { patch: match?.[1] ?? null, date: null };
}

function stripHtml(input: string) {
  return input.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, " ").trim();
}

function parseD2ptBuilds(html: string): Record<string, BuildSnapshot> {
  const result: Record<string, BuildSnapshot> = {};
  const rows = html.match(/<(?:tr|article)[^>]*>[\s\S]*?<\/(?:tr|article)>/gi) ?? [];
  const roleNames: Array<[number, RegExp]> = [[1, /\bcarry\b/i], [2, /\bmid\b/i], [3, /\bofflane\b/i], [4, /(?<!hard )\bsupport\b/i], [5, /\bhard support\b/i]];
  for (const row of rows) {
    const text = stripHtml(row);
    const hero = CATALOG.find((candidate) => new RegExp(`\\b${candidate.name.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}\\b`, "i").test(text));
    const role = roleNames.find(([, pattern]) => pattern.test(text))?.[0];
    if (!hero || !role) continue;
    const imageLabels = [...row.matchAll(/(?:alt|title)=["']([^"']+)["']/gi)].map((match) => match[1].trim()).filter((value) => value && !/^(image|carry|mid|offlane|support|hard support)$/i.test(value));
    const items = imageLabels.filter((value) => !value.includes(hero.name)).slice(0, 8);
    if (!items.length) continue;
    const sampleMatch = text.match(/\b(\d{1,5})\s*(?:matches|матч)/i);
    const winRateMatch = text.match(/\b(\d{2}(?:\.\d)?)%/);
    const key = `${hero.id}:${role}`;
    result[key] = { heroId: hero.id, role, sample: Number(sampleMatch?.[1] ?? 0), starting: items.slice(0, 2), early: items.slice(0, 3), core: items.map((item, index) => ({ item, timing: `${Math.max(8, (index + 1) * 5)}'` })), situational: [], skills: [], talents: [], source: `D2PT authorized feed${winRateMatch ? ` · ${winRateMatch[1]}% WR` : ""}` };
  }
  return result;
}

function normalizeHeroStats(rows: unknown): Record<string, HeroMetaSnapshot> {
  if (!Array.isArray(rows)) return {};
  const result: Record<string, HeroMetaSnapshot> = {};
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const value = row as Record<string, unknown>;
    const id = Number(value.id);
    if (!Number.isInteger(id) || id <= 0) continue;
    const proMatches = Number(value.pro_pick) || 0;
    const proWins = Number(value.pro_win) || 0;
    const publicMatches = Number(value.pub_pick) || 0;
    const publicWins = Number(value.pub_win) || 0;
    const matches = proMatches > 0 ? proMatches : publicMatches;
    const wins = proMatches > 0 ? proWins : publicWins;
    if (matches <= 0) continue;
    result[String(id)] = { matches, winRate: Math.round((wins / matches) * 1000) / 10 };
  }
  return result;
}

function normalizeBuildFeed(input: unknown): Record<string, BuildSnapshot> {
  const rows = Array.isArray(input) ? input : input && typeof input === "object" && Array.isArray((input as { builds?: unknown }).builds) ? (input as { builds: unknown[] }).builds : [];
  const result: Record<string, BuildSnapshot> = {};
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const value = row as Record<string, unknown>;
    const heroId = Number(value.heroId);
    const role = Number(value.role);
    if (!Number.isInteger(heroId) || ![1, 2, 3, 4, 5].includes(role)) continue;
    const list = (name: string) => Array.isArray(value[name]) ? value[name].filter((item): item is string => typeof item === "string").slice(0, 12) : [];
    const core = Array.isArray(value.core) ? value.core.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const coreItem = item as Record<string, unknown>;
      return typeof coreItem.item === "string" ? [{ item: coreItem.item, timing: typeof coreItem.timing === "string" ? coreItem.timing : "—" }] : [];
    }).slice(0, 8) : [];
    result[`${heroId}:${role}`] = {
      heroId,
      role,
      sample: Math.max(0, Number(value.sample) || 0),
      starting: list("starting"),
      early: list("early"),
      core,
      situational: [],
      skills: list("skills"),
      talents: [],
      source: typeof value.source === "string" ? value.source : "Configured build feed",
    };
  }
  return result;
}

export async function getDotaUpdateSnapshot(): Promise<DotaUpdateSnapshot> {
  return rowToSnapshot(await readRow());
}

let refreshPromise: Promise<DotaUpdateSnapshot> | null = null;

async function refreshDotaUpdateInternal(force: boolean): Promise<DotaUpdateSnapshot> {
  const row = await readRow();
  const current = rowToSnapshot(row);
  const checkedAt = asNumber(row?.checked_at) ?? 0;
  const checkedAtMs = checkedAt && checkedAt < 10_000_000_000 ? checkedAt * 1000 : checkedAt;
  const hasMetaSnapshot = Object.keys(current.heroStats).length > 0;
  const refreshWindow = current.status === "ok" && hasMetaSnapshot ? REFRESH_MS : ERROR_RETRY_MS;
  if (!force && checkedAtMs && Date.now() - checkedAtMs < refreshWindow) return current;

  const d2ptEnabled = runtimeEnv("D2PT_PERMISSION_CONFIRMED") === "1";
  const activeSource = d2ptEnabled ? `${SOURCE_URL} · ${D2PT_META_URL} · ${D2PT_BUILDS_URL}` : SOURCE_URL;
  const [patchResult, newsResult, statsResult, d2ptMetaResult] = await Promise.allSettled([
    fetchJson<unknown>(VALVE_PATCHES_URL),
    fetchJson<{ appnews?: { newsitems?: SteamNewsItem[] } }>(STEAM_NEWS_URL),
    fetchJson<unknown>(OPENDOTA_HERO_STATS_URL),
    d2ptEnabled ? fetchText(D2PT_META_URL) : Promise.resolve(""),
  ]);
  const valvePatch = patchResult.status === "fulfilled" ? patchFromValve(patchResult.value) : { patch: null, date: null };
  const news = newsResult.status === "fulfilled" ? newsResult.value.appnews?.newsitems ?? [] : [];
  const newsPatch = patchFromNews(news);
  const d2ptPatch = d2ptMetaResult.status === "fulfilled" && d2ptMetaResult.value ? patchFromText(d2ptMetaResult.value) : { patch: null, date: null };
  const parsedPatch = valvePatch.patch ? valvePatch : newsPatch.patch ? newsPatch : d2ptPatch;
  const freshHeroStats = statsResult.status === "fulfilled" ? normalizeHeroStats(statsResult.value) : {};
  const heroStats = Object.keys(freshHeroStats).length ? freshHeroStats : current.heroStats;
  const now = new Date().toISOString();
  const buildFeedUrl = runtimeEnv("DOTA_BUILD_FEED_URL");
  let builds = current.builds;
  let buildsStatus: DotaUpdateSnapshot["buildsStatus"] = Object.keys(current.builds).length ? "stale" : "fallback";
  let buildsUpdatedAt = current.buildsUpdatedAt;
  if (buildFeedUrl && /^https:\/\//i.test(buildFeedUrl)) {
    try {
      const feed = await fetchJson<unknown>(buildFeedUrl);
      const freshBuilds = normalizeBuildFeed(feed);
      if (Object.keys(freshBuilds).length) {
        builds = freshBuilds;
        buildsStatus = "fresh";
        buildsUpdatedAt = now;
      } else buildsStatus = "error";
    } catch {
      buildsStatus = Object.keys(current.builds).length ? "stale" : "error";
    }
  } else if (d2ptEnabled) {
    try {
      const d2ptBuilds = parseD2ptBuilds(await fetchText(D2PT_BUILDS_URL));
      if (Object.keys(d2ptBuilds).length) {
        builds = d2ptBuilds;
        buildsStatus = "fresh";
        buildsUpdatedAt = now;
      } else if (!Object.keys(current.builds).length) buildsStatus = "error";
    } catch {
      buildsStatus = Object.keys(current.builds).length ? "stale" : "error";
    }
  }
  const sourceErrors = [
    patchResult.status === "rejected" ? "Valve patch feed" : null,
    newsResult.status === "rejected" ? "Steam News" : null,
    statsResult.status === "rejected" ? "OpenDota hero stats" : null,
    d2ptEnabled && d2ptMetaResult.status === "rejected" ? "D2PT meta" : null,
  ].filter((value): value is string => Boolean(value));
  if (buildsStatus === "error") sourceErrors.push("role build feed");
  const lastError = sourceErrors.length ? `Недоступны источники: ${sourceErrors.join(", ")}` : null;
  const status: DotaUpdateSnapshot["status"] = Object.keys(freshHeroStats).length || parsedPatch.patch ? "ok" : heroStats && Object.keys(heroStats).length ? "stale" : "error";
  const effectivePatch = parsedPatch.patch ?? (current.status === "error" ? PATCH : current.patch);
  const dataUpdatedAt = Object.keys(freshHeroStats).length || (d2ptEnabled && d2ptMetaResult.status === "fulfilled" && Boolean(d2ptMetaResult.value)) ? now : current.dataUpdatedAt;
  const payload = JSON.stringify({
    news: news.slice(0, 20),
    heroStats,
    builds,
    buildsStatus,
    dataUpdatedAt,
    buildsUpdatedAt,
    lastError,
  });
  await persist({ patch: effectivePatch, status, payload, source: activeSource, sourceUpdatedAt: parsedPatch.date ?? (current.sourceUpdatedAt ? new Date(current.sourceUpdatedAt) : null) });
  return {
    patch: effectivePatch,
    checkedAt: now,
    sourceUpdatedAt: parsedPatch.date?.toISOString() ?? current.sourceUpdatedAt,
    dataUpdatedAt,
    buildsUpdatedAt,
    status,
    buildsStatus,
    lastError,
    source: activeSource,
    heroStats,
    builds,
  };
}

export async function refreshDotaUpdate(force = false): Promise<DotaUpdateSnapshot> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = refreshDotaUpdateInternal(force).finally(() => { refreshPromise = null; });
  return refreshPromise;
}

export async function ensureDotaUpdate() {
  return refreshDotaUpdate(false);
}

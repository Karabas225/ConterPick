import { asIso, asNumber, storeFirst, storeRun } from "./app-store";
import { CATALOG, PATCH, normalizeRemoteCatalog, setCatalog, type Hero } from "./dota-data";

const VALVE_PATCHES_URL = "https://www.dota2.com/datafeed/patchnoteslist?language=english";
const STEAM_NEWS_URL = "https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=570&count=50&maxlength=2000";
const OPENDOTA_HERO_STATS_URL = "https://api.opendota.com/api/heroStats";
// D2PT's current, server-rendered role table lives on the mobile meta route.
// It exposes the same 7k+/pro role statistics without accepting any user URL.
const D2PT_META_URL = "https://dota2protracker.com/m/meta";
const D2PT_BUILDS_URL = "https://dota2protracker.com/builds";
const D2PT_COMBOS_URL = "https://dota2protracker.com/combos";
const SOURCE_URL = `${VALVE_PATCHES_URL} · ${STEAM_NEWS_URL} · ${OPENDOTA_HERO_STATS_URL}`;
const REFRESH_MS = 24 * 60 * 60 * 1000;
const ERROR_RETRY_MS = 15 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 12_000;
const D2PT_MIN_REQUEST_GAP_MS = 1_000;
let lastD2ptRequestAt = 0;

export type HeroMetaSnapshot = { matches: number; winRate: number; rating?: number; laneAdvantage?: number };
export type PairSnapshot = { heroId: number; otherHeroId: number; matches: number; winRate: number; role?: number };
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
  rating?: number;
  winRate?: number;
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
  catalog: Hero[];
  matchups: PairSnapshot[];
  synergies: PairSnapshot[];
};

type SteamNewsItem = { title?: string; contents?: string; date?: number; url?: string };
type UpdateRow = { current_patch: string; checked_at: unknown; source_updated_at: unknown; status: string; source: string; payload?: unknown };

function runtimeEnv(key: string) {
  const processEnv = (globalThis as typeof globalThis & { process?: { env?: Record<string, string> } }).process?.env;
  return processEnv?.[key];
}

function parsePayload(payload: unknown): { heroStats: Record<string, HeroMetaSnapshot>; builds: Record<string, BuildSnapshot>; catalog: Hero[]; matchups: PairSnapshot[]; synergies: PairSnapshot[]; dataUpdatedAt: string | null; buildsUpdatedAt: string | null; buildsStatus: DotaUpdateSnapshot["buildsStatus"]; lastError: string | null } {
  if (typeof payload !== "string") return { heroStats: {}, builds: {}, catalog: [], matchups: [], synergies: [], dataUpdatedAt: null, buildsUpdatedAt: null, buildsStatus: "fallback", lastError: null };
  try {
    const parsed = JSON.parse(payload) as Record<string, unknown>;
    const heroStats = parsed.heroStats && typeof parsed.heroStats === "object" ? parsed.heroStats as Record<string, HeroMetaSnapshot> : {};
    const builds = parsed.builds && typeof parsed.builds === "object" ? parsed.builds as Record<string, BuildSnapshot> : {};
    // Older cache snapshots may contain provider-specific or incorrect image
    // links (for example `magnus.png`).  Re-normalize the cached catalog on
    // every read so a stale snapshot cannot reintroduce a broken portrait.
    const savedCatalog = Array.isArray(parsed.catalog) ? parsed.catalog as Hero[] : [];
    const catalog = savedCatalog.length ? normalizeRemoteCatalog(savedCatalog) : [];
    const matchups = Array.isArray(parsed.matchups) ? parsed.matchups as PairSnapshot[] : [];
    const synergies = Array.isArray(parsed.synergies) ? parsed.synergies as PairSnapshot[] : [];
    return {
      heroStats, builds, catalog, matchups, synergies,
      dataUpdatedAt: typeof parsed.dataUpdatedAt === "string" ? parsed.dataUpdatedAt : null,
      buildsUpdatedAt: typeof parsed.buildsUpdatedAt === "string" ? parsed.buildsUpdatedAt : null,
      buildsStatus: parsed.buildsStatus === "fresh" || parsed.buildsStatus === "stale" || parsed.buildsStatus === "error" ? parsed.buildsStatus : "fallback",
      lastError: typeof parsed.lastError === "string" ? parsed.lastError : null,
    };
  } catch {
    return { heroStats: {}, builds: {}, catalog: [], matchups: [], synergies: [], dataUpdatedAt: null, buildsUpdatedAt: null, buildsStatus: "fallback", lastError: null };
  }
}

function rowToSnapshot(row: UpdateRow | undefined): DotaUpdateSnapshot {
  const parsed = parsePayload(row?.payload);
  const catalog = parsed.catalog.length >= 100 ? parsed.catalog : CATALOG;
  setCatalog(catalog);
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
    catalog,
    matchups: parsed.matchups,
    synergies: parsed.synergies,
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

/** The permission only covers a narrow, server-side adapter. Keep its traffic
 * predictable: one request at a time and no more than one per second. */
async function fetchAuthorizedD2pt(url: string) {
  const wait = Math.max(0, D2PT_MIN_REQUEST_GAP_MS - (Date.now() - lastD2ptRequestAt));
  if (wait) await new Promise<void>((resolve) => setTimeout(resolve, wait));
  lastD2ptRequestAt = Date.now();
  return fetchText(url);
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

function escapeRegExp(value: string) { return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

function compactNumber(value: string, suffix?: string) {
  const number = Number(value.replace(/,/g, ""));
  if (!Number.isFinite(number)) return 0;
  return Math.round(number * (suffix?.toUpperCase() === "K" ? 1000 : suffix?.toUpperCase() === "M" ? 1_000_000 : 1));
}

/** Parses the role-specific mobile table, which D2PT keeps server rendered.
 * The table provides role, matches, win rate, lane advantage and D2PT rating.
 * A failure returns an empty snapshot rather than guessing per-role meta. */
export function parseD2ptRoleMeta(html: string, catalog: Hero[]): Record<string, HeroMetaSnapshot> {
  const text = stripHtml(html);
  const section = text.slice(Math.max(0, text.indexOf("Hero Meta")));
  const roles: Array<[number, string]> = [[1, "Carry"], [2, "Mid"], [3, "Offlane"], [4, "Support"], [5, "Hard Support"]];
  const result: Record<string, HeroMetaSnapshot> = {};
  for (const [role, label] of roles) {
    const heading = new RegExp(`\\b${escapeRegExp(label)}\\b`, "g");
    const matches = [...section.matchAll(heading)];
    const start = matches[0]?.index;
    if (start === undefined) continue;
    const laterHeadings = roles.filter(([, other]) => other !== label).map(([, other]) => {
      const match = new RegExp(`\\b${escapeRegExp(other)}\\b`, "g");
      match.lastIndex = start + label.length;
      return match.exec(section)?.index;
    }).filter((index): index is number => typeof index === "number" && index > start);
    const end = Math.min(section.indexOf("All Heroes", start) > start ? section.indexOf("All Heroes", start) : Number.POSITIVE_INFINITY, ...laterHeadings, section.length);
    const roleText = section.slice(start, end);
    for (const hero of catalog) {
      const pattern = new RegExp(`${escapeRegExp(hero.name)}\\s+WR\\s+([\\d.]+)%\\s+Lane\\s+([+-]?[\\d.]+)%\\s+Matches\\s+([\\d.,]+)\\s*([KM])?\\s+Rating\\s+(\\d+)`, "gi");
      const row = pattern.exec(roleText);
      if (!row) continue;
      const matchesCount = compactNumber(row[3], row[4]);
      const winRate = Number(row[1]);
      const laneAdvantage = Number(row[2]);
      const rating = Number(row[5]);
      if (matchesCount <= 0 || !Number.isFinite(winRate)) continue;
      result[`${hero.id}:${role}`] = { matches: matchesCount, winRate, ...(Number.isFinite(rating) ? { rating } : {}), ...(Number.isFinite(laneAdvantage) ? { laneAdvantage } : {}) };
    }
  }
  return result;
}

/** Parse the stable pair text rendered by D2PT's combos page. The parser is
 * intentionally strict: a markup change produces no fabricated rows and the
 * cached snapshot remains available. */
function parseD2ptPairs(html: string, catalog: Hero[], mode: "synergy" | "matchup"): PairSnapshot[] {
  const text = stripHtml(html);
  const byName = new Map(catalog.map((hero) => [hero.name.toLowerCase(), hero]));
  const names = catalog.map((hero) => hero.name).sort((a, b) => b.length - a.length).map(escapeRegExp).join("|");
  if (!names) return [];
  const pattern = new RegExp(`(${names})\\s*\\+\\s*(${names})\\s+([\\d,]+)\\s+games?\\s+(?:Lane Adv\\.\\s*[+-]?[\\d.]+%\\s+)?WR\\s+([\\d.]+)%`, "gi");
  const pairs: PairSnapshot[] = [];
  for (const match of text.matchAll(pattern)) {
    const context = text.slice(Math.max(0, (match.index ?? 0) - 260), match.index ?? 0).toLowerCase();
    const synergySection = context.lastIndexOf("match synergies") > Math.max(context.lastIndexOf("matchups"), context.lastIndexOf("lane matchups"));
    const matchupSection = /matchups|counter picks/.test(context) && !synergySection;
    if ((mode === "synergy" && !synergySection) || (mode === "matchup" && !matchupSection)) continue;
    const left = byName.get(match[1].toLowerCase()); const right = byName.get(match[2].toLowerCase());
    const matches = Number(match[3].replace(/,/g, "")); const winRate = Number(match[4]);
    if (!left || !right || left.id === right.id || !Number.isFinite(matches) || !Number.isFinite(winRate) || matches <= 0) continue;
    pairs.push({ heroId: left.id, otherHeroId: right.id, matches, winRate });
    pairs.push({ heroId: right.id, otherHeroId: left.id, matches, winRate: Math.max(0, Math.min(100, 100 - (winRate - 50))) });
  }
  return pairs;
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
    const ratingMatch = text.match(/\brating\s*(\d{2,4})\b/i);
    const key = `${hero.id}:${role}`;
    const candidate = {
      heroId: hero.id, role, sample: Number(sampleMatch?.[1] ?? 0), starting: items.slice(0, 2), early: items.slice(0, 3),
      core: items.map((item, index) => ({ item, timing: `${Math.max(8, (index + 1) * 5)}'` })), situational: [], skills: [], talents: [],
      source: `D2PT authorized feed${winRateMatch ? ` · ${winRateMatch[1]}% WR` : ""}`,
      ...(winRateMatch ? { winRate: Number(winRateMatch[1]) } : {}), ...(ratingMatch ? { rating: Number(ratingMatch[1]) } : {}),
    } satisfies BuildSnapshot;
    const existing = result[key];
    if (!existing || (candidate.rating ?? 0) > (existing.rating ?? 0) || ((candidate.rating ?? 0) === (existing.rating ?? 0) && candidate.sample > existing.sample)) result[key] = candidate;
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
    // A single professional pick is not a meta signal. Prefer pro data only
    // after it clears a minimum sample; otherwise use the larger public pool
    // until D2PT's role-specific pro snapshot is available.
    const hasReliableProSample = proMatches >= 100;
    const matches = hasReliableProSample ? proMatches : publicMatches;
    const wins = hasReliableProSample ? proWins : publicWins;
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
      ...(Number.isFinite(Number(value.rating)) ? { rating: Number(value.rating) } : {}),
      ...(Number.isFinite(Number(value.winRate)) ? { winRate: Number(value.winRate) } : {}),
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
  const activeSource = d2ptEnabled ? `${SOURCE_URL} · ${D2PT_META_URL} · ${D2PT_COMBOS_URL} · ${D2PT_BUILDS_URL}` : SOURCE_URL;
  const [patchResult, newsResult, statsResult] = await Promise.allSettled([
    fetchJson<unknown>(VALVE_PATCHES_URL),
    fetchJson<{ appnews?: { newsitems?: SteamNewsItem[] } }>(STEAM_NEWS_URL),
    fetchJson<unknown>(OPENDOTA_HERO_STATS_URL),
  ]);
  let d2ptMetaResult: PromiseSettledResult<string> = { status: "fulfilled", value: "" };
  let d2ptCombosResult: PromiseSettledResult<string> = { status: "fulfilled", value: "" };
  if (d2ptEnabled) {
    d2ptMetaResult = await fetchAuthorizedD2pt(D2PT_META_URL).then(
      (value) => ({ status: "fulfilled", value }) as const,
      (reason) => ({ status: "rejected", reason }) as const,
    );
    d2ptCombosResult = await fetchAuthorizedD2pt(D2PT_COMBOS_URL).then(
      (value) => ({ status: "fulfilled", value }) as const,
      (reason) => ({ status: "rejected", reason }) as const,
    );
  }
  const valvePatch = patchResult.status === "fulfilled" ? patchFromValve(patchResult.value) : { patch: null, date: null };
  const news = newsResult.status === "fulfilled" ? newsResult.value.appnews?.newsitems ?? [] : [];
  const newsPatch = patchFromNews(news);
  const d2ptPatch = d2ptMetaResult.status === "fulfilled" && d2ptMetaResult.value ? patchFromText(d2ptMetaResult.value) : { patch: null, date: null };
  const parsedPatch = valvePatch.patch ? valvePatch : newsPatch.patch ? newsPatch : d2ptPatch;
  const freshHeroStats = statsResult.status === "fulfilled" ? normalizeHeroStats(statsResult.value) : {};
  const heroStats = Object.keys(freshHeroStats).length ? freshHeroStats : current.heroStats;
  const freshCatalog = statsResult.status === "fulfilled" ? normalizeRemoteCatalog(statsResult.value) : [];
  const catalog = freshCatalog.length >= 100 ? freshCatalog : current.catalog.length >= 100 ? current.catalog : CATALOG;
  setCatalog(catalog);
  const freshSynergies = d2ptCombosResult.status === "fulfilled" && d2ptCombosResult.value ? parseD2ptPairs(d2ptCombosResult.value, catalog, "synergy") : [];
  const freshMatchups = d2ptCombosResult.status === "fulfilled" && d2ptCombosResult.value ? parseD2ptPairs(d2ptCombosResult.value, catalog, "matchup") : [];
  const matchups = freshMatchups.length ? freshMatchups : current.matchups;
  const synergies = freshSynergies.length ? freshSynergies : current.synergies;
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
      const d2ptBuilds = parseD2ptBuilds(await fetchAuthorizedD2pt(D2PT_BUILDS_URL));
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
    d2ptEnabled && d2ptCombosResult.status === "rejected" ? "D2PT combos" : null,
  ].filter((value): value is string => Boolean(value));
  if (buildsStatus === "error") sourceErrors.push("role build feed");
  const lastError = sourceErrors.length ? `Недоступны источники: ${sourceErrors.join(", ")}` : null;
  const status: DotaUpdateSnapshot["status"] = Object.keys(freshHeroStats).length || parsedPatch.patch ? "ok" : heroStats && Object.keys(heroStats).length ? "stale" : "error";
  const effectivePatch = parsedPatch.patch ?? (current.status === "error" ? PATCH : current.patch);
  const dataUpdatedAt = Object.keys(freshHeroStats).length || freshCatalog.length >= 100 || (d2ptEnabled && d2ptMetaResult.status === "fulfilled" && Boolean(d2ptMetaResult.value)) ? now : current.dataUpdatedAt;
  const payload = JSON.stringify({
    news: news.slice(0, 20),
    heroStats,
    catalog,
    matchups,
    synergies,
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
    catalog,
    matchups,
    synergies,
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

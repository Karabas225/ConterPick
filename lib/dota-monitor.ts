import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { dotaUpdates } from "../db/schema";
import { PATCH } from "./dota-data";

const STEAM_NEWS_URL = "https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=570&count=20&maxlength=1200";
const REFRESH_MS = 6 * 60 * 60 * 1000;

export type DotaUpdateSnapshot = {
  patch: string;
  checkedAt: string | null;
  sourceUpdatedAt: string | null;
  status: "ok" | "stale" | "error" | "unknown";
  source: string;
};

type SteamNewsItem = { title?: string; contents?: string; date?: number; url?: string };

function asIso(value: Date | number | null | undefined) { return value ? new Date(value).toISOString() : null; }
function rowToSnapshot(row: typeof dotaUpdates.$inferSelect | undefined): DotaUpdateSnapshot {
  return { patch: row?.currentPatch ?? PATCH, checkedAt: asIso(row?.checkedAt), sourceUpdatedAt: asIso(row?.sourceUpdatedAt), status: (row?.status as DotaUpdateSnapshot["status"]) ?? "unknown", source: row?.source ?? STEAM_NEWS_URL };
}

async function readRow() {
  try { const rows = await (await getDb()).select().from(dotaUpdates).where(eq(dotaUpdates.id, 1)).limit(1); return rows[0]; }
  catch { return undefined; }
}

async function persist(snapshot: { patch: string; status: string; payload?: string; sourceUpdatedAt?: Date | null }) {
  try {
    const db = await getDb();
    const values = { id: 1, source: STEAM_NEWS_URL, currentPatch: snapshot.patch, status: snapshot.status, payload: snapshot.payload ?? "{}", checkedAt: new Date(), sourceUpdatedAt: snapshot.sourceUpdatedAt ?? null };
    const existing = await db.select({ id: dotaUpdates.id }).from(dotaUpdates).where(eq(dotaUpdates.id, 1)).limit(1);
    if (existing.length) await db.update(dotaUpdates).set(values).where(eq(dotaUpdates.id, 1));
    else await db.insert(dotaUpdates).values(values);
  } catch { /* local preview can run without D1 */ }
}

function patchFromNews(items: SteamNewsItem[]) {
  const patchPattern = /\b(7\.\d{1,3}[a-z]?)\b/gi;
  for (const item of items) {
    const match = `${item.title ?? ""} ${item.contents ?? ""}`.match(patchPattern);
    if (match?.[0]) return { patch: match[0], date: item.date ? new Date(item.date * 1000) : null };
  }
  return { patch: null, date: null };
}

export async function getDotaUpdateSnapshot(): Promise<DotaUpdateSnapshot> { return rowToSnapshot(await readRow()); }

export async function refreshDotaUpdate(force = false): Promise<DotaUpdateSnapshot> {
  const row = await readRow();
  const current = rowToSnapshot(row);
  const checkedAt = row?.checkedAt instanceof Date ? row.checkedAt.getTime() : 0;
  if (!force && checkedAt && Date.now() - checkedAt < REFRESH_MS) return current;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const response = await fetch(STEAM_NEWS_URL, { headers: { accept: "application/json" }, signal: controller.signal });
    clearTimeout(timeout);
    if (!response.ok) throw new Error(`Steam news returned ${response.status}`);
    const payload = await response.json() as { appnews?: { newsitems?: SteamNewsItem[] } };
    const items = payload.appnews?.newsitems ?? [];
    const parsed = patchFromNews(items);
    await persist({ patch: parsed.patch ?? current.patch, status: parsed.patch ? "ok" : "stale", sourceUpdatedAt: parsed.date, payload: JSON.stringify(items.slice(0, 8)) });
    return { patch: parsed.patch ?? current.patch, checkedAt: new Date().toISOString(), sourceUpdatedAt: asIso(parsed.date), status: parsed.patch ? "ok" : "stale", source: STEAM_NEWS_URL };
  } catch {
    await persist({ patch: current.patch, status: "error", sourceUpdatedAt: row?.sourceUpdatedAt ?? null });
    return { ...current, checkedAt: new Date().toISOString(), status: "error" };
  }
}

export async function ensureDotaUpdate() { return refreshDotaUpdate(false); }

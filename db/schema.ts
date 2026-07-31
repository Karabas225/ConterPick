import { sql } from "drizzle-orm";
import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const now = sql.raw("CURRENT_TIMESTAMP");
export const pageCache = sqliteTable("page_cache", {
  id: integer("id").primaryKey({ autoIncrement: true }), cacheKey: text("cache_key").notNull(),
  sourcePath: text("source_path").notNull(), payload: text("payload").notNull(), patch: text("patch").notNull().default(""),
  fetchedAt: integer("fetched_at", { mode: "timestamp_ms" }).notNull().default(now), expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => ({ cacheKeyIndex: uniqueIndex("page_cache_key_idx").on(table.cacheKey) }));
export const metaStats = sqliteTable("meta_stats", {
  id: integer("id").primaryKey({ autoIncrement: true }), heroId: integer("hero_id").notNull(), role: integer("role").notNull(),
  matches: integer("matches").notNull(), winRate: integer("win_rate").notNull(), rating: integer("rating").notNull(),
  patch: text("patch").notNull(), updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(now),
});
export const pairStats = sqliteTable("pair_stats", {
  id: integer("id").primaryKey({ autoIncrement: true }), heroId: integer("hero_id").notNull(), otherHeroId: integer("other_hero_id").notNull(),
  relation: text("relation").notNull(), matches: integer("matches").notNull(), advantage: integer("advantage").notNull(), patch: text("patch").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(now),
});
export const buildCache = sqliteTable("build_cache", {
  id: integer("id").primaryKey({ autoIncrement: true }), heroId: integer("hero_id").notNull(), role: integer("role").notNull(),
  enemyHash: text("enemy_hash").notNull(), payload: text("payload").notNull(), sample: integer("sample").notNull(), patch: text("patch").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(now),
});

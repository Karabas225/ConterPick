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

export const users = sqliteTable("users", {
  id: text("id").primaryKey(), email: text("email"), phone: text("phone"), displayName: text("display_name").notNull(),
  passwordHash: text("password_hash").notNull(), role: text("role").notNull().default("user"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(now),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(now),
}, (table) => ({ emailIndex: uniqueIndex("users_email_idx").on(table.email), phoneIndex: uniqueIndex("users_phone_idx").on(table.phone) }));

export const authSessions = sqliteTable("auth_sessions", {
  tokenHash: text("token_hash").primaryKey(), userId: text("user_id").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(now),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
});

export const draftEvents = sqliteTable("draft_events", {
  id: text("id").primaryKey(), userId: text("user_id"), anonymousId: text("anonymous_id"), targetRole: integer("target_role").notNull(),
  alliesJson: text("allies_json").notNull(), enemiesJson: text("enemies_json").notNull(), recommendationsJson: text("recommendations_json").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(now),
});

export const pickFeedback = sqliteTable("pick_feedback", {
  id: text("id").primaryKey(), eventId: text("event_id"), userId: text("user_id"), heroId: integer("hero_id").notNull(),
  used: integer("used", { mode: "boolean" }).notNull(), outcome: text("outcome"), rating: integer("rating"), note: text("note"), contextJson: text("context_json").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(now),
});

export const tickets = sqliteTable("tickets", {
  id: text("id").primaryKey(), userId: text("user_id"), subject: text("subject").notNull(), description: text("description").notNull(),
  status: text("status").notNull().default("open"), closedBy: text("closed_by"), closedAt: integer("closed_at", { mode: "timestamp_ms" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(now),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(now),
});

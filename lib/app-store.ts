/**
 * Small SQL adapter shared by Cloudflare D1 and the self-hosted Node runtime.
 *
 * The application only needs a handful of simple queries for accounts,
 * feedback, tickets and the patch monitor. Keeping those queries behind this
 * adapter means the same API can run on D1 in production or on Node's built-in
 * SQLite driver behind Nginx, without requiring a native npm module.
 */

type SqlValue = string | number | null | Uint8Array | Date | boolean;
type SqlRow = Record<string, unknown>;

const NODE_SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY NOT NULL, email TEXT UNIQUE, phone TEXT UNIQUE,
  display_name TEXT NOT NULL, password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user', created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS auth_sessions (
  token_hash TEXT PRIMARY KEY NOT NULL, user_id TEXT NOT NULL,
  created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS auth_sessions_user_idx ON auth_sessions(user_id);
CREATE INDEX IF NOT EXISTS auth_sessions_expiry_idx ON auth_sessions(expires_at);
CREATE TABLE IF NOT EXISTS draft_events (
  id TEXT PRIMARY KEY NOT NULL, user_id TEXT, anonymous_id TEXT, target_role INTEGER NOT NULL,
  allies_json TEXT NOT NULL, enemies_json TEXT NOT NULL, recommendations_json TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS draft_events_user_idx ON draft_events(user_id, created_at);
CREATE TABLE IF NOT EXISTS pick_feedback (
  id TEXT PRIMARY KEY NOT NULL, event_id TEXT, user_id TEXT, hero_id INTEGER NOT NULL,
  used INTEGER NOT NULL, outcome TEXT, rating INTEGER, note TEXT, context_json TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS pick_feedback_created_idx ON pick_feedback(created_at);
CREATE INDEX IF NOT EXISTS pick_feedback_hero_idx ON pick_feedback(hero_id, used);
CREATE TABLE IF NOT EXISTS tickets (
  id TEXT PRIMARY KEY NOT NULL, user_id TEXT, subject TEXT NOT NULL, description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open', closed_by TEXT, closed_at INTEGER,
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS tickets_status_idx ON tickets(status, updated_at);
CREATE INDEX IF NOT EXISTS tickets_user_idx ON tickets(user_id, created_at);
CREATE TABLE IF NOT EXISTS dota_updates (
  id INTEGER PRIMARY KEY NOT NULL, source TEXT NOT NULL, current_patch TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'unknown', payload TEXT NOT NULL DEFAULT '{}',
  checked_at INTEGER NOT NULL, source_updated_at INTEGER
);
CREATE TABLE IF NOT EXISTS site_settings (
  key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL DEFAULT '{}', updated_at INTEGER NOT NULL
);
`;

function runtimeEnv(key: string): string | undefined {
  const processEnv = (globalThis as typeof globalThis & { process?: { env?: Record<string, string> } }).process?.env;
  return processEnv?.[key];
}

function dynamicImport<T = Record<string, unknown>>(specifier: string): Promise<T> {
  return Function("specifier", "return import(specifier)")(specifier) as Promise<T>;
}

export function isSelfHostedRuntime() {
  const processLike = (globalThis as typeof globalThis & { process?: { versions?: { node?: string } } }).process;
  return runtimeEnv("SELF_HOST") === "1" || !!processLike?.versions?.node;
}

let nodeDatabase: {
  exec(sql: string): void;
  prepare(sql: string): { all(...params: unknown[]): SqlRow[]; get(...params: unknown[]): SqlRow | undefined; run(...params: unknown[]): unknown };
} | null = null;

async function getNodeDatabase() {
  if (nodeDatabase) return nodeDatabase;
  const [sqlite, fs, path] = await Promise.all([
    dynamicImport<{ DatabaseSync: new (path: string) => typeof nodeDatabase }>("node:sqlite"),
    dynamicImport<typeof import("node:fs")>("node:fs"),
    dynamicImport<typeof import("node:path")>("node:path"),
  ]);
  const configuredPath = runtimeEnv("SELF_HOST_DB_PATH") || path.join(runtimeEnv("COUNTERPICK_DATA_DIR") || path.join(process.cwd(), "data"), "counterpick.sqlite");
  fs.mkdirSync(path.dirname(configuredPath), { recursive: true });
  const database = new sqlite.DatabaseSync(configuredPath);
  database.exec(NODE_SCHEMA);
  nodeDatabase = database as unknown as NonNullable<typeof nodeDatabase>;
  return nodeDatabase;
}

function normalizeParams(params: readonly SqlValue[]) {
  return params.map((value) => value instanceof Date ? value.getTime() : typeof value === "boolean" ? (value ? 1 : 0) : value);
}

export async function storeAll<T extends SqlRow = SqlRow>(sql: string, params: readonly SqlValue[] = []): Promise<T[]> {
  if (isSelfHostedRuntime()) return (await getNodeDatabase()).prepare(sql).all(...normalizeParams(params)) as T[];
  const { env } = await import("cloudflare:workers") as unknown as { env: { DB?: { prepare(sql: string): { bind(...params: unknown[]): { all<T>(): Promise<{ results: T[] }> } } } } };
  if (!env.DB) throw new Error("D1 binding DB is not configured");
  const result = await env.DB.prepare(sql).bind(...normalizeParams(params)).all<T>();
  return result.results ?? [];
}

export async function storeFirst<T extends SqlRow = SqlRow>(sql: string, params: readonly SqlValue[] = []) {
  const rows = await storeAll<T>(sql, params);
  return rows[0];
}

export async function storeRun(sql: string, params: readonly SqlValue[] = []) {
  if (isSelfHostedRuntime()) {
    (await getNodeDatabase()).prepare(sql).run(...normalizeParams(params));
    return;
  }
  const { env } = await import("cloudflare:workers") as unknown as { env: { DB?: { prepare(sql: string): { bind(...params: unknown[]): { run(): Promise<unknown> } } } } };
  if (!env.DB) throw new Error("D1 binding DB is not configured");
  await env.DB.prepare(sql).bind(...normalizeParams(params)).run();
}

export function asNumber(value: unknown): number | null {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return null;
}

export function asIso(value: unknown) {
  const timestamp = asNumber(value);
  return timestamp ? new Date(timestamp < 10_000_000_000 ? timestamp * 1000 : timestamp).toISOString() : null;
}

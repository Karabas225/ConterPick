import { asIso, storeFirst, storeRun } from "./app-store";

export type SiteMessageKind = "auth" | "info";
export type SiteMessage = {
  title: string;
  body: string;
  buttonLabel: string;
  kind: SiteMessageKind;
  enabled: boolean;
  updatedAt: string | null;
};

const SETTING_KEY = "site_message";
const DEFAULT_SITE_MESSAGE: SiteMessage = {
  title: "Помогите нам улучшать CounterPick",
  body: "Войдите или зарегистрируйтесь, чтобы мы связывали драфты, feedback и результаты с вашим профилем. Сообщение можно отключить в админ-панели.",
  buttonLabel: "Войти / зарегистрироваться",
  kind: "auth",
  enabled: true,
  updatedAt: null,
};

function normalizeMessage(value: unknown, updatedAt: string | null): SiteMessage {
  if (!value || typeof value !== "object") return { ...DEFAULT_SITE_MESSAGE, updatedAt };
  const input = value as Record<string, unknown>;
  return {
    title: typeof input.title === "string" && input.title.trim() ? input.title.trim().slice(0, 120) : DEFAULT_SITE_MESSAGE.title,
    body: typeof input.body === "string" && input.body.trim() ? input.body.trim().slice(0, 1000) : DEFAULT_SITE_MESSAGE.body,
    buttonLabel: typeof input.buttonLabel === "string" && input.buttonLabel.trim() ? input.buttonLabel.trim().slice(0, 60) : DEFAULT_SITE_MESSAGE.buttonLabel,
    kind: input.kind === "info" ? "info" : "auth",
    enabled: input.enabled !== false,
    updatedAt,
  };
}

export async function getSiteMessage(): Promise<SiteMessage> {
  try {
    const row = await storeFirst<{ value?: unknown; updated_at?: unknown }>("SELECT value, updated_at FROM site_settings WHERE key = ? LIMIT 1", [SETTING_KEY]);
    if (!row) return { ...DEFAULT_SITE_MESSAGE };
    let parsed: unknown = null;
    try { parsed = typeof row.value === "string" ? JSON.parse(row.value) : row.value; } catch { parsed = null; }
    return normalizeMessage(parsed, asIso(row.updated_at));
  } catch {
    return { ...DEFAULT_SITE_MESSAGE };
  }
}

export async function saveSiteMessage(input: Partial<SiteMessage>): Promise<SiteMessage> {
  const current = await getSiteMessage();
  const updatedAtMs = Date.now();
  const next = normalizeMessage({ ...current, ...input }, new Date(updatedAtMs).toISOString());
  const value = JSON.stringify({ title: next.title, body: next.body, buttonLabel: next.buttonLabel, kind: next.kind, enabled: next.enabled });
  const existing = await storeFirst<{ key: string }>("SELECT key FROM site_settings WHERE key = ? LIMIT 1", [SETTING_KEY]);
  if (existing) await storeRun("UPDATE site_settings SET value = ?, updated_at = ? WHERE key = ?", [value, updatedAtMs, SETTING_KEY]);
  else await storeRun("INSERT INTO site_settings (key, value, updated_at) VALUES (?, ?, ?)", [SETTING_KEY, value, updatedAtMs]);
  return next;
}

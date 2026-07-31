import { asIso, storeAll, storeRun } from "./app-store";
import { getCurrentUser } from "./app-auth";
import { findHero, ROLE_LABELS } from "./dota-data";
import { getSiteMessage } from "./site-settings";

export type DraftSnapshot = { targetRole: number; allies: unknown[]; enemies: unknown[]; recommendations: unknown[] };

export async function recordDraft(request: Request, snapshot: DraftSnapshot) {
  try {
    const user = await getCurrentUser(request).catch(() => null);
    const id = crypto.randomUUID();
    await storeRun("INSERT INTO draft_events (id, user_id, anonymous_id, target_role, allies_json, enemies_json, recommendations_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", [id, user?.id ?? null, null, snapshot.targetRole, JSON.stringify(snapshot.allies), JSON.stringify(snapshot.enemies), JSON.stringify(snapshot.recommendations), Date.now()]);
    return id;
  } catch { return null; }
}

export async function recordFeedback(request: Request, input: { eventId?: string | null; heroId: number; used: boolean; outcome?: string | null; rating?: number | null; note?: string | null; context: Record<string, unknown> }) {
  const user = await getCurrentUser(request).catch(() => null);
  const id = crypto.randomUUID();
  await storeRun("INSERT INTO pick_feedback (id, event_id, user_id, hero_id, used, outcome, rating, note, context_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [id, input.eventId ?? null, user?.id ?? null, input.heroId, input.used, input.outcome ?? null, input.rating ?? null, input.note?.slice(0, 1000) ?? null, JSON.stringify(input.context), Date.now()]);
  return id;
}

export async function recentAdminData() {
  const [ticketRows, feedbackRows, draftRows, userRows, feedbackStatsRows, draftStatsRows, ticketStatsRows, message] = await Promise.all([
    storeAll<Record<string, unknown>>("SELECT id, user_id, subject, description, status, closed_by, closed_at, created_at, updated_at FROM tickets ORDER BY updated_at DESC LIMIT 100"),
    storeAll<Record<string, unknown>>("SELECT id, event_id, user_id, hero_id, used, outcome, rating, note, context_json, created_at FROM pick_feedback ORDER BY created_at DESC LIMIT 100"),
    storeAll<Record<string, unknown>>("SELECT id, user_id, anonymous_id, target_role, allies_json, enemies_json, recommendations_json, created_at FROM draft_events ORDER BY created_at DESC LIMIT 100"),
    storeAll<Record<string, unknown>>("SELECT id, email, phone, display_name, role, created_at, updated_at FROM users ORDER BY created_at DESC LIMIT 100"),
    storeAll<Record<string, unknown>>("SELECT used, COUNT(*) AS count FROM pick_feedback GROUP BY used"),
    storeAll<Record<string, unknown>>("SELECT target_role, COUNT(*) AS count FROM draft_events GROUP BY target_role"),
    storeAll<Record<string, unknown>>("SELECT status, COUNT(*) AS count FROM tickets GROUP BY status"),
    getSiteMessage(),
  ]);
  const tickets = ticketRows.map((row) => ({ ...row, userId: row.user_id ?? null, closedBy: row.closed_by ?? null, closedAt: asIso(row.closed_at), createdAt: asIso(row.created_at), updatedAt: asIso(row.updated_at) }));
  const feedback = feedbackRows.map((row) => ({ ...row, eventId: row.event_id ?? null, userId: row.user_id ?? null, heroId: Number(row.hero_id), used: Boolean(row.used), contextJson: row.context_json, createdAt: asIso(row.created_at) }));
  const drafts = draftRows.map((row) => ({ ...row, userId: row.user_id ?? null, anonymousId: row.anonymous_id ?? null, targetRole: Number(row.target_role), alliesJson: row.allies_json, enemiesJson: row.enemies_json, recommendationsJson: row.recommendations_json, createdAt: asIso(row.created_at) }));
  const users = userRows.map((row) => ({ id: String(row.id), email: row.email ?? null, phone: row.phone ?? null, displayName: String(row.display_name ?? "CounterPick player"), role: String(row.role ?? "user"), createdAt: asIso(row.created_at), updatedAt: asIso(row.updated_at) }));
  const topPicks = new Map<number, number>();
  for (const draft of drafts) {
    try {
      const parsed = JSON.parse(String(draft.recommendationsJson ?? "[]")) as Array<{ heroId?: unknown }>;
      for (const recommendation of parsed.slice(0, 5)) {
        const heroId = Number(recommendation.heroId);
        if (Number.isInteger(heroId)) topPicks.set(heroId, (topPicks.get(heroId) ?? 0) + 1);
      }
    } catch { /* malformed historical telemetry should not break the admin desk */ }
  }
  const roleStats = draftStatsRows.map((row) => ({ label: ROLE_LABELS[Number(row.target_role) as keyof typeof ROLE_LABELS] ?? `P${row.target_role}`, value: Number(row.count) || 0 }));
  const feedbackStats = feedbackStatsRows.map((row) => ({ label: Number(row.used) ? "Использовали" : "Пропустили", value: Number(row.count) || 0 }));
  const ticketStats = ticketStatsRows.map((row) => ({ label: String(row.status) === "closed" ? "Закрытые" : "Открытые", value: Number(row.count) || 0 }));
  const picks = [...topPicks.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([heroId, value]) => ({ label: findHero(heroId)?.shortName ?? `Hero #${heroId}`, value }));
  return { tickets, feedback, drafts, users, message, stats: { roles: roleStats, feedback: feedbackStats, tickets: ticketStats, picks } };
}

export function isTicketOwner(ticketUserId: string | null, currentUserId: string | null) { return !!ticketUserId && !!currentUserId && ticketUserId === currentUserId; }

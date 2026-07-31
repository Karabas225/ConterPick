import { findHero, type DraftHero, type RoleId } from "../../../lib/dota-data";
import { recommend } from "../../../lib/recommendation";
import { recordDraft } from "../../../lib/telemetry";
import { ensureDotaUpdate } from "../../../lib/dota-monitor";
function isRole(value: unknown): value is RoleId { return [1, 2, 3, 4, 5].includes(Number(value)); }
function parseDraft(value: unknown, max: number) {
  if (!Array.isArray(value) || value.length > max) throw new Error("Too many heroes");
  const seen = new Set<number>();
  return value.map((entry) => {
    const id = Number((entry as { heroId?: unknown })?.heroId); const hero = findHero(id);
    if (!hero || seen.has(id)) throw new Error("Unknown or duplicate hero");
    seen.add(id); const role = (entry as { role?: unknown })?.role;
    return { ...hero, ...(isRole(role) ? { role } : {}) } as DraftHero;
  });
}
export async function POST(request: Request) {
  try {
    const body = await request.json() as { targetRole?: unknown; allies?: unknown; enemies?: unknown };
    if (!isRole(body.targetRole)) return Response.json({ error: "targetRole must be 1..5" }, { status: 400 });
    const allies = parseDraft(body.allies ?? [], 4); const enemies = parseDraft(body.enemies ?? [], 5);
    if (!enemies.length) return Response.json({ error: "At least one enemy is required" }, { status: 400 });
    const update = await ensureDotaUpdate();
    const recommendations = recommend(allies, enemies, body.targetRole, update.heroStats);
    const eventId = await recordDraft(request, { targetRole: body.targetRole, allies: allies.map(({ id, role }) => ({ heroId: id, role })), enemies: enemies.map(({ id, role }) => ({ heroId: id, role })), recommendations });
    return Response.json({ patch: update.patch, updatedAt: update.dataUpdatedAt ?? update.checkedAt ?? new Date().toISOString(), updateStatus: update.status, sourceUpdatedAt: update.sourceUpdatedAt, dataUpdatedAt: update.dataUpdatedAt, buildsUpdatedAt: update.buildsUpdatedAt, buildsStatus: update.buildsStatus, eventId, recommendations });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Invalid draft" }, { status: 400 }); }
}

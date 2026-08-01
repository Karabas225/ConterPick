import { findHero, type DraftHero, type RoleId } from "../../../lib/dota-data";
import { recommend, type EncounterMode, type RecommendationMode } from "../../../lib/recommendation";
import { ensureDotaUpdate } from "../../../lib/dota-monitor";
import { recordDraft } from "../../../lib/telemetry";
import { STRATEGIES, type StrategyId } from "../../../lib/tactics";

function isRole(value: unknown): value is RoleId { return [1, 2, 3, 4, 5].includes(Number(value)); }
function isStrategy(value: unknown): value is StrategyId { return typeof value === "string" && value in STRATEGIES; }
function isEncounter(value: unknown): value is EncounterMode { return value === "auto" || value === "solo" || value === "duo" || value === "trio" || value === "teamfight"; }
function isMode(value: unknown): value is RecommendationMode { return value === "tactical" || value === "classic"; }

function parseDraft(value: unknown, max: number) {
  if (!Array.isArray(value) || value.length > max) throw new Error("Too many heroes");
  const seen = new Set<number>();
  return value.map((entry) => {
    const id = Number((entry as { heroId?: unknown })?.heroId);
    const hero = findHero(id);
    if (!hero || seen.has(id)) throw new Error("Unknown or duplicate hero");
    seen.add(id);
    const role = (entry as { role?: unknown })?.role;
    const lane = (entry as { lane?: unknown })?.lane;
    return { ...hero, ...(isRole(role) ? { role } : {}), ...(lane === true ? { lane: true } : {}) } as DraftHero;
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { targetRole?: unknown; allies?: unknown; enemies?: unknown; strategy?: unknown; encounter?: unknown; mode?: unknown };
    if (!isRole(body.targetRole)) return Response.json({ error: "targetRole must be 1..5" }, { status: 400 });
    if (body.strategy !== undefined && !isStrategy(body.strategy)) return Response.json({ error: "Unknown strategy" }, { status: 400 });
    if (body.encounter !== undefined && !isEncounter(body.encounter)) return Response.json({ error: "Unknown encounter" }, { status: 400 });
    if (body.mode !== undefined && !isMode(body.mode)) return Response.json({ error: "Unknown recommendation mode" }, { status: 400 });
    const allies = parseDraft(body.allies ?? [], 4);
    const enemies = parseDraft(body.enemies ?? [], 5);
    if (!enemies.length) return Response.json({ error: "At least one enemy is required" }, { status: 400 });
    const allIds = [...allies, ...enemies].map((hero) => hero.id);
    if (new Set(allIds).size !== allIds.length) return Response.json({ error: "A hero cannot be selected for both teams" }, { status: 400 });
    const update = await ensureDotaUpdate();
    const strategy = isStrategy(body.strategy) ? body.strategy : "balanced";
    const encounter = isEncounter(body.encounter) ? body.encounter : "auto";
    const mode = isMode(body.mode) ? body.mode : "tactical";
    const recommendations = recommend(allies, enemies, body.targetRole, update.heroStats, { matchups: update.matchups, synergies: update.synergies }, { strategy, encounter, mode });
    const eventId = await recordDraft(request, {
      targetRole: body.targetRole,
      allies: allies.map(({ id, role, lane }) => ({ heroId: id, role, lane })),
      enemies: enemies.map(({ id, role, lane }) => ({ heroId: id, role, lane })),
      recommendations,
    });
    return Response.json({ patch: update.patch, updatedAt: update.dataUpdatedAt ?? update.checkedAt ?? new Date().toISOString(), updateStatus: update.status, sourceUpdatedAt: update.sourceUpdatedAt, dataUpdatedAt: update.dataUpdatedAt, buildsUpdatedAt: update.buildsUpdatedAt, buildsStatus: update.buildsStatus, eventId, recommendations });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Invalid draft" }, { status: 400 });
  }
}

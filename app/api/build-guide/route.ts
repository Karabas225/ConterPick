import { findHero, type RoleId } from "../../../lib/dota-data";
import { buildGuide, type EncounterMode, type RecommendationMode } from "../../../lib/recommendation";
import { ensureDotaUpdate } from "../../../lib/dota-monitor";
import { STRATEGIES, type StrategyId } from "../../../lib/tactics";

function isStrategy(value: unknown): value is StrategyId { return typeof value === "string" && value in STRATEGIES; }
function isEncounter(value: unknown): value is EncounterMode { return value === "auto" || value === "solo" || value === "duo" || value === "trio" || value === "teamfight"; }
function isMode(value: unknown): value is RecommendationMode { return value === "tactical" || value === "classic"; }

export async function POST(request: Request) {
  try {
    const body = await request.json() as { heroId?: unknown; targetRole?: unknown; enemyHeroIds?: unknown; strategy?: unknown; encounter?: unknown; mode?: unknown };
    const heroId = Number(body.heroId);
    const targetRole = Number(body.targetRole) as RoleId;
    const enemyHeroIds = Array.isArray(body.enemyHeroIds) ? body.enemyHeroIds.map(Number) : [];
    if (!isStrategy(body.strategy ?? "balanced") || !isEncounter(body.encounter ?? "auto") || !isMode(body.mode ?? "tactical")) return Response.json({ error: "Unknown build context" }, { status: 400 });
    const hero = findHero(heroId);
    if (!hero || !hero.roles.includes(targetRole) || ![1, 2, 3, 4, 5].includes(targetRole) || enemyHeroIds.length > 5 || enemyHeroIds.some((id) => !findHero(id)) || new Set(enemyHeroIds).size !== enemyHeroIds.length) return Response.json({ error: "Герой недоступен для выбранной позиции" }, { status: 400 });
    const update = await ensureDotaUpdate();
    const guide = buildGuide(heroId, targetRole, enemyHeroIds, update.builds, { strategy: body.strategy ?? "balanced", encounter: body.encounter ?? "auto", mode: body.mode ?? "tactical" });
    guide.patch = update.patch;
    guide.source = `${guide.source} · ${update.patch}`;
    return Response.json({ guide, patch: update.patch, updateStatus: update.status, sourceUpdatedAt: update.sourceUpdatedAt, dataUpdatedAt: update.dataUpdatedAt, buildsUpdatedAt: update.buildsUpdatedAt, buildsStatus: update.buildsStatus });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Invalid request" }, { status: 400 });
  }
}

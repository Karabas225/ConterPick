import { findHero, type RoleId } from "../../../lib/dota-data";
import { buildGuide } from "../../../lib/recommendation";
import { ensureDotaUpdate } from "../../../lib/dota-monitor";
export async function POST(request: Request) {
  try {
    const body = await request.json() as { heroId?: unknown; targetRole?: unknown; enemyHeroIds?: unknown };
    const heroId = Number(body.heroId); const targetRole = Number(body.targetRole) as RoleId;
    const enemyHeroIds = Array.isArray(body.enemyHeroIds) ? body.enemyHeroIds.map(Number) : [];
    const hero = findHero(heroId);
    if (!hero || !hero.roles.includes(targetRole) || ![1, 2, 3, 4, 5].includes(targetRole) || enemyHeroIds.some((id) => !findHero(id))) return Response.json({ error: "Герой не доступен для выбранной позиции" }, { status: 400 });
    const update = await ensureDotaUpdate();
    const guide = buildGuide(heroId, targetRole, enemyHeroIds, update.builds);
    guide.patch = update.patch;
    guide.source = `${guide.source} · ${update.patch}`;
    return Response.json({ guide, patch: update.patch, updateStatus: update.status, sourceUpdatedAt: update.sourceUpdatedAt, dataUpdatedAt: update.dataUpdatedAt, buildsUpdatedAt: update.buildsUpdatedAt, buildsStatus: update.buildsStatus });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Invalid request" }, { status: 400 }); }
}

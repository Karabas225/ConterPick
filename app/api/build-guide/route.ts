import { findHero, type RoleId } from "../../../lib/dota-data";
import { buildGuide } from "../../../lib/recommendation";
export async function POST(request: Request) {
  try {
    const body = await request.json() as { heroId?: unknown; targetRole?: unknown; enemyHeroIds?: unknown };
    const heroId = Number(body.heroId); const targetRole = Number(body.targetRole) as RoleId;
    const enemyHeroIds = Array.isArray(body.enemyHeroIds) ? body.enemyHeroIds.map(Number) : [];
    if (!findHero(heroId) || ![1, 2, 3, 4, 5].includes(targetRole) || enemyHeroIds.some((id) => !findHero(id))) return Response.json({ error: "Invalid build request" }, { status: 400 });
    return Response.json({ guide: buildGuide(heroId, targetRole, enemyHeroIds) });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Invalid request" }, { status: 400 }); }
}

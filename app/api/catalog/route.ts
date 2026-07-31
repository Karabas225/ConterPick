import { serializeCatalog } from "../../../lib/dota-data";
import { ensureDotaUpdate } from "../../../lib/dota-monitor";
export async function GET() { const update = await ensureDotaUpdate(); return Response.json({ ...serializeCatalog(), patch: update.patch, updateStatus: update.status, sourceUpdatedAt: update.sourceUpdatedAt, dataUpdatedAt: update.dataUpdatedAt, buildsUpdatedAt: update.buildsUpdatedAt, buildsStatus: update.buildsStatus }, { headers: { "cache-control": "public, max-age=300" } }); }

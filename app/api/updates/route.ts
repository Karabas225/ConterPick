import { ensureDotaUpdate } from "../../../lib/dota-monitor";

export async function GET() {
  return Response.json(await ensureDotaUpdate());
}

import { ensureDotaUpdate, refreshDotaUpdate } from "../../../lib/dota-monitor";

export async function GET(request: Request) {
  const force = new URL(request.url).searchParams.get("force") === "1";
  return Response.json(await (force ? refreshDotaUpdate(true) : ensureDotaUpdate()), { headers: { "cache-control": "no-store" } });
}

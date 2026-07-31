import { getCurrentUser } from "../../../../lib/app-auth";

export async function GET(request: Request) {
  try { return Response.json({ user: await getCurrentUser(request) }); }
  catch { return Response.json({ user: null }); }
}

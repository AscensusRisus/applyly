import { env } from "cloudflare:workers";
import { getApplicationAnalytics } from "../storage";

export async function GET(request: Request) {
  try { return Response.json(await getApplicationAnalytics(env.DB, new URL(request.url).searchParams.get("year") ?? undefined)); }
  catch (error) { return Response.json({ error: String(error) }, { status: 500 }); }
}

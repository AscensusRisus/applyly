import { env } from "cloudflare:workers";
import { authorizeExtensionRequest } from "../security";
import { findExtensionMatches, loadExtensionApplications } from "../matching";

type MatchRequest = { company?: string; domain?: string; url?: string; aliases?: string[] };

async function matchCompany(request: Request) {
  if (!(await authorizeExtensionRequest(request, env.DB))) {
    return Response.json({ error: "A valid extension pairing token is required" }, { status: 401 });
  }

  let payload: MatchRequest;
  try {
    payload = await request.json() as MatchRequest;
  } catch {
    return Response.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }

  const company = payload.company?.trim() ?? "";
  const aliases = Array.isArray(payload.aliases) ? payload.aliases : [];
  if (!company && !aliases.length && !payload.domain?.trim() && !payload.url?.trim()) {
    return Response.json({ error: "Company name, alias, company domain, or application URL is required" }, { status: 400 });
  }

  const applications = await loadExtensionApplications(env.DB);
  const matches = findExtensionMatches(applications, payload);
  return Response.json({
    query: { company: company || null, domain: payload.domain ?? null, url: payload.url ?? null, aliases },
    matches,
  });
}

export async function POST(request: Request) {
  try {
    return await matchCompany(request);
  } catch (error) {
    return Response.json({ error: String(error) }, { status: 500 });
  }
}
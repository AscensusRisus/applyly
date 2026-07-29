import { env } from "cloudflare:workers";
import { createApplication, isValidAppliedDate, listApplications, type ApplicationPayload } from "./storage";

function db() { if (!env.DB) throw new Error("D1 binding unavailable"); return env.DB; }

export async function GET() {
  try { return Response.json({ applications: await listApplications(db()) }); }
  catch (error) { return Response.json({ error: String(error) }, { status: 500 }); }
}

export async function POST(request: Request) {
  const payload = (await request.json()) as ApplicationPayload;
  if (!payload.company?.trim() || !payload.role?.trim()) return Response.json({ error: "Company and role are required" }, { status: 400 });
  if (!isValidAppliedDate(payload.appliedDate)) return Response.json({ error: "Applied date must be a valid YYYY-MM-DD value" }, { status: 400 });
  try { return Response.json({ application: await createApplication(db(), payload) }, { status: 201 }); }
  catch (error) { return Response.json({ error: String(error) }, { status: 500 }); }
}

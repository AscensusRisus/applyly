import { env } from "cloudflare:workers";
import { createApplication, findDuplicateApplication, listApplications, validateApplicationFields, type ApplicationPayload } from "./storage";

type CreateApplicationRequest = ApplicationPayload & { allowDuplicate?: boolean };

function db() { if (!env.DB) throw new Error("D1 binding unavailable"); return env.DB; }

export async function GET() {
  try { return Response.json({ applications: await listApplications(db()) }); }
  catch (error) { return Response.json({ error: String(error) }, { status: 500 }); }
}

export async function POST(request: Request) {
  let payload: CreateApplicationRequest;
  try { payload = (await request.json()) as CreateApplicationRequest; } catch { return Response.json({ error: "Request body must be valid JSON" }, { status: 400 }); }
  const validationError = validateApplicationFields(payload);
  if (validationError) return Response.json({ error: validationError }, { status: 400 });

  try {
    if (payload.allowDuplicate !== true) {
      const duplicate = await findDuplicateApplication(db(), payload);
      if (duplicate) return Response.json({
        error: "A matching application already exists",
        code: "DUPLICATE_APPLICATION",
        duplicate: { id: duplicate.id, company: duplicate.company, role: duplicate.role, status: duplicate.status, appliedDate: duplicate.appliedDate },
      }, { status: 409 });
    }
    return Response.json({ application: await createApplication(db(), payload) }, { status: 201 });
  }
  catch (error) { return Response.json({ error: String(error) }, { status: 500 }); }
}

import { env } from "cloudflare:workers";
import { applicationStatuses, deleteApplication, getApplicationHistory, rollbackApplicationStatus, updateApplicationDetails, updateApplicationStatus, type ApplicationPayload } from "../storage";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try { return Response.json({ history: await getApplicationHistory(env.DB, id) }); }
  catch (error) { return Response.json({ error: String(error) }, { status: 500 }); }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let payload: { status?: string; undoHistoryId?: number; details?: ApplicationPayload };
  try { payload = (await request.json()) as typeof payload; } catch { return Response.json({ error: "Request body must be valid JSON" }, { status: 400 }); }
  if (payload.undoHistoryId) {
    try {
      const result = await rollbackApplicationStatus(env.DB, id, payload.undoHistoryId);
      if (!result.meta.changes) return Response.json({ error: result.reason ?? "History entry not found" }, { status: 400 });
      return Response.json({ ok: true, status: result.status });
    } catch (error) { return Response.json({ error: String(error) }, { status: 500 }); }
  }
  if (payload.details) {

    try {
      const result = await updateApplicationDetails(env.DB, id, payload.details);
      if (!result.meta.changes) { const exists = await env.DB.prepare("SELECT id FROM applications WHERE id = ?").bind(id).first(); return Response.json({ error: exists ? (result.reason ?? "Application could not be updated") : "Application not found" }, { status: exists ? 400 : 404 }); }
      const current = await env.DB.prepare("SELECT status FROM applications WHERE id = ?").bind(id).first<{status:string}>();
      return Response.json({ ok: true, application: { ...result.application, status: current?.status ?? "Applied" } });
    } catch (error) { return Response.json({ error: String(error) }, { status: 500 }); }
  }
  if (!payload.status?.trim()) return Response.json({ error: "Status is required" }, { status: 400 });
  if (!applicationStatuses.includes(payload.status.trim() as typeof applicationStatuses[number])) return Response.json({ error: "Status is invalid" }, { status: 400 });
  try {
    const result = await updateApplicationStatus(env.DB, id, payload.status.trim());
    if (!result.meta.changes) return Response.json({ error: "Application not found" }, { status: 404 });
    return Response.json({ ok: true });
  } catch (error) { return Response.json({ error: String(error) }, { status: 500 }); }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const result = await deleteApplication(env.DB, id);
    if (!result.meta.changes) return Response.json({ error: "Application not found" }, { status: 404 });
    return Response.json({ ok: true });
  } catch (error) { return Response.json({ error: String(error) }, { status: 500 }); }
}

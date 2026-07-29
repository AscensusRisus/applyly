import { env } from "cloudflare:workers";
import { deleteApplication, getApplicationHistory, isValidAppliedDate, rollbackApplicationStatus, updateApplicationDetails, updateApplicationStatus, type ApplicationPayload } from "../storage";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try { return Response.json({ history: await getApplicationHistory(env.DB, id) }); }
  catch (error) { return Response.json({ error: String(error) }, { status: 500 }); }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const payload = (await request.json()) as { status?: string; undoHistoryId?: number; details?: ApplicationPayload };
  if (payload.undoHistoryId) {
    try {
      const result = await rollbackApplicationStatus(env.DB, id, payload.undoHistoryId);
      if (!result.meta.changes) return Response.json({ error: result.reason ?? "History entry not found" }, { status: 400 });
      return Response.json({ ok: true, status: result.status });
    } catch (error) { return Response.json({ error: String(error) }, { status: 500 }); }
  }
  if (payload.details) {
    if (!isValidAppliedDate(payload.details.appliedDate)) return Response.json({ error: "Applied date must be a valid YYYY-MM-DD value" }, { status: 400 });
    try {
      const result = await updateApplicationDetails(env.DB, id, payload.details);
      if (!result.meta.changes) return Response.json({ error: result.reason ?? "Application not found" }, { status: 400 });
      const current = await env.DB.prepare("SELECT status FROM applications WHERE id = ?").bind(id).first<{status:string}>();
      return Response.json({ ok: true, application: { ...result.application, status: current?.status ?? "Applied" } });
    } catch (error) { return Response.json({ error: String(error) }, { status: 500 }); }
  }
  if (!payload.status?.trim()) return Response.json({ error: "Status is required" }, { status: 400 });
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

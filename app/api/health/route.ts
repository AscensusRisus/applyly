import { env } from "cloudflare:workers";
import { applicationStatuses } from "../../lib/application-options";
import { getExtensionPairingState } from "../extension/security";

export async function GET() {
  try {
    const pairing = await getExtensionPairingState(env.DB);
    return Response.json({
      ok: true,
      name: "applyly",
      version: "0.2.0",
      apiVersion: 1,
      backupVersion: 1,
      statuses: applicationStatuses,
      capabilities: ["applications", "status-history", "analytics", "backup", "bulk-delete", "extension-company-match", "extension-page-match"],
      extension: {
        supported: true,
        apiBase: "/api/extension",
        transport: "extension-host-permission",
        pairingRequired: true,
        paired: pairing.paired,
        mutationsEnabled: false,
        features: ["company-match", "page-match", "application-url-match", "per-candidate-matches", "guided-card-actions"],
      },
    });
  } catch (error) {
    return Response.json({ ok: false, error: String(error) }, { status: 500 });
  }
}

import { env } from "cloudflare:workers";
import { createExtensionPairing, getExtensionPairingState, isLocalPairingManagementRequest, revokeExtensionPairing } from "../security";

export async function GET() {
  try { return Response.json(await getExtensionPairingState(env.DB)); }
  catch (error) { return Response.json({ error: String(error) }, { status: 500 }); }
}

export async function POST(request: Request) {
  if (!isLocalPairingManagementRequest(request)) return Response.json({ error: "Pairing must be managed from the local Applyly origin" }, { status: 403 });
  try {
    const pairing = await createExtensionPairing(env.DB);
    return Response.json({ paired: true, ...pairing, message: "Copy this token now. Applyly stores only its hash." }, { status: 201 });
  } catch (error) {
    return Response.json({ error: String(error) }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  if (!isLocalPairingManagementRequest(request)) return Response.json({ error: "Pairing must be managed from the local Applyly origin" }, { status: 403 });
  try {
    await revokeExtensionPairing(env.DB);
    return Response.json({ paired: false });
  } catch (error) {
    return Response.json({ error: String(error) }, { status: 500 });
  }
}

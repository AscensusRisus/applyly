import { ensureApplicationsTable } from "../applications/storage";

const pairingId = 1;

async function hashToken(token: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}

function generateToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
}

export function isLocalPairingManagementRequest(request: Request) {
  if (request.headers.get("X-Applyly-Pairing") !== "manage") return false;
  const origin = request.headers.get("Origin");
  return !origin || origin === new URL(request.url).origin;
}

export async function getExtensionPairingState(db: D1Database) {
  await ensureApplicationsTable(db);
  const pairing = await db.prepare("SELECT created_at as createdAt FROM extension_pairings WHERE id = ?").bind(pairingId).first<{createdAt:number}>();
  return { paired: Boolean(pairing), createdAt: pairing?.createdAt ?? null };
}

export async function createExtensionPairing(db: D1Database) {
  await ensureApplicationsTable(db);
  const token = generateToken();
  const createdAt = Date.now();
  await db.prepare("INSERT INTO extension_pairings (id, token_hash, created_at) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET token_hash = excluded.token_hash, created_at = excluded.created_at").bind(pairingId, await hashToken(token), createdAt).run();
  return { token, createdAt };
}

export async function revokeExtensionPairing(db: D1Database) {
  await ensureApplicationsTable(db);
  await db.prepare("DELETE FROM extension_pairings WHERE id = ?").bind(pairingId).run();
}

function hashesEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}
export async function authorizeExtensionRequest(request: Request, db: D1Database) {
  const authorization = request.headers.get("Authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) return false;
  const token = authorization.slice(7).trim();
  if (!token) return false;
  await ensureApplicationsTable(db);
  const pairing = await db.prepare("SELECT token_hash as tokenHash FROM extension_pairings WHERE id = ?").bind(pairingId).first<{tokenHash:string}>();
  return Boolean(pairing && hashesEqual(pairing.tokenHash, await hashToken(token)));
}

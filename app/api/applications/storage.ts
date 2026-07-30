export const applicationsMigration = `CREATE TABLE IF NOT EXISTS applications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company TEXT NOT NULL,
  role TEXT NOT NULL,
  location TEXT NOT NULL DEFAULT 'Remote',
  status TEXT NOT NULL DEFAULT 'Applied',
  applied_date TEXT NOT NULL,
  salary TEXT,
  url TEXT,
  notes TEXT,
  contact_email TEXT,
  source TEXT,
  next_step TEXT,
  next_action_date TEXT,
  created_at INTEGER NOT NULL
)`;

export const statusHistoryMigration = `CREATE TABLE IF NOT EXISTS application_status_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  application_id INTEGER NOT NULL,
  status TEXT NOT NULL,
  changed_at INTEGER NOT NULL,
  note TEXT
)`;

export type ApplicationPayload = {
  company?: string; role?: string; location?: string; status?: string;
  appliedDate?: string; salary?: string; url?: string; notes?: string;
  contactEmail?: string; source?: string; nextStep?: string; nextActionDate?: string;
};

export function isValidAppliedDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00`);
  return !Number.isNaN(parsed.valueOf()) && `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}` === value;
}
export async function ensureApplicationsTable(db: D1Database) {
  await db.prepare(applicationsMigration).run();
  await db.prepare(statusHistoryMigration).run();
  for (const statement of ["ALTER TABLE applications ADD COLUMN contact_email TEXT", "ALTER TABLE applications ADD COLUMN source TEXT", "ALTER TABLE applications ADD COLUMN next_step TEXT", "ALTER TABLE applications ADD COLUMN next_action_date TEXT"]) { try { await db.prepare(statement).run(); } catch (error) { if (!String(error).toLowerCase().includes("duplicate column")) throw error; } }
  await db.prepare("INSERT INTO application_status_history (application_id, status, changed_at, note) SELECT a.id, a.status, a.created_at, 'Imported from existing application' FROM applications a WHERE NOT EXISTS (SELECT 1 FROM application_status_history h WHERE h.application_id = a.id)").run();
}

export async function listApplications(db: D1Database) {
  await ensureApplicationsTable(db);
  const result = await db.prepare("SELECT id, company, role, location, status, applied_date as appliedDate, salary, url, notes, contact_email as contactEmail, source, next_step as nextStep, next_action_date as nextActionDate FROM applications ORDER BY applied_date DESC, id DESC").all();
  return result.results;
}

export async function createApplication(db: D1Database, payload: ApplicationPayload) {
  const company = payload.company?.trim() ?? "";
  const role = payload.role?.trim() ?? "";
  const location = payload.location?.trim() || "Remote";
  const status = payload.status?.trim() || "Applied";
  const appliedDate = payload.appliedDate?.trim() ?? "";
  if (!isValidAppliedDate(appliedDate)) throw new Error("Applied date must be a valid YYYY-MM-DD value");
  const contactEmail = payload.contactEmail?.trim() || null;
  const source = payload.source?.trim() || null;
  const nextStep = payload.nextStep?.trim() || null;
  const nextActionDate = payload.nextActionDate || null;
  await ensureApplicationsTable(db);
  const result = await db.prepare("INSERT INTO applications (company, role, location, status, applied_date, salary, url, notes, contact_email, source, next_step, next_action_date, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(company, role, location, status, appliedDate, payload.salary?.trim() || null, payload.url?.trim() || null, payload.notes?.trim() || null, contactEmail, source, nextStep, nextActionDate, Date.now()).run();
  const id = result.meta.last_row_id;
  await db.prepare("INSERT INTO application_status_history (application_id, status, changed_at, note) VALUES (?, ?, ?, ?)").bind(id, status, Date.now(), "Application created").run();
  return { id, company, role, location, status, appliedDate, salary: payload.salary?.trim() || null, url: payload.url?.trim() || null, notes: payload.notes?.trim() || null, contactEmail, source, nextStep, nextActionDate };
}

export async function deleteApplication(db: D1Database, id: string) {
  await ensureApplicationsTable(db);
  await db.prepare("DELETE FROM application_status_history WHERE application_id = ?").bind(id).run();
  return db.prepare("DELETE FROM applications WHERE id = ?").bind(id).run();
}

export async function updateApplicationStatus(db: D1Database, id: string, status: string) {
  await ensureApplicationsTable(db);
  const current = await db.prepare("SELECT status FROM applications WHERE id = ?").bind(id).first<{status:string}>();
  if (!current) return { meta: { changes: 0 } };
  if (current.status === status) return { meta: { changes: 1 } };
  const result = await db.prepare("UPDATE applications SET status = ? WHERE id = ?").bind(status, id).run();
  if (result.meta.changes) await db.prepare("INSERT INTO application_status_history (application_id, status, changed_at, note) VALUES (?, ?, ?, ?)").bind(id, status, Date.now(), "Status updated").run();
  return result;
}

export async function updateApplicationDetails(db: D1Database, id: string, payload: ApplicationPayload) {
  const company = payload.company?.trim() ?? "";
  const role = payload.role?.trim() ?? "";
  if (!company || !role) return { meta: { changes: 0 }, reason: "Company and role are required" };
  const location = payload.location?.trim() || "Remote";
  const appliedDate = payload.appliedDate?.trim() ?? "";
  if (!isValidAppliedDate(appliedDate)) throw new Error("Applied date must be a valid YYYY-MM-DD value");
  const salary = payload.salary?.trim() || null;
  const url = payload.url?.trim() || null;
  const notes = payload.notes?.trim() || null;
  const contactEmail = payload.contactEmail?.trim() || null;
  const source = payload.source?.trim() || null;
  const nextStep = payload.nextStep?.trim() || null;
  const nextActionDate = payload.nextActionDate || null;
  await ensureApplicationsTable(db);
  const result = await db.prepare("UPDATE applications SET company = ?, role = ?, location = ?, applied_date = ?, salary = ?, url = ?, notes = ?, contact_email = ?, source = ?, next_step = ?, next_action_date = ? WHERE id = ?").bind(company, role, location, appliedDate, salary, url, notes, contactEmail, source, nextStep, nextActionDate, id).run();
  return { meta: result.meta, application: { id: Number(id), company, role, location, appliedDate, salary, url, notes, contactEmail, source, nextStep, nextActionDate } };
}
export async function getApplicationHistory(db: D1Database, id: string) {
  await ensureApplicationsTable(db);
  const result = await db.prepare("SELECT id, status, changed_at as changedAt, note FROM application_status_history WHERE application_id = ? ORDER BY changed_at ASC, id ASC").bind(id).all();
  return result.results;
}

export async function rollbackApplicationStatus(db: D1Database, applicationId: string, historyId: number) {
  await ensureApplicationsTable(db);
  const entries = await db.prepare("SELECT id, status FROM application_status_history WHERE application_id = ? ORDER BY changed_at ASC, id ASC").bind(applicationId).all<{ id:number; status:string }>();
  const index = entries.results.findIndex(entry => entry.id === historyId);
  if (index <= 0) return { meta: { changes: 0 }, reason: "The application creation entry cannot be undone" };
  const previous = entries.results[index - 1];
  const toDelete = entries.results.slice(index).map(entry => db.prepare("DELETE FROM application_status_history WHERE id = ? AND application_id = ?").bind(entry.id, applicationId));
  const update = db.prepare("UPDATE applications SET status = ? WHERE id = ?").bind(previous.status, applicationId);
  const results = await db.batch([update, ...toDelete]);
  return { meta: { changes: results[0].meta.changes }, status: previous.status };
}
export async function getApplicationAnalytics(db: D1Database, year?: string) {
  await ensureApplicationsTable(db);
  const selectedYear = year && /^\d{4}$/.test(year) ? year : null;
  const applications = selectedYear
    ? await db.prepare("SELECT id, status FROM applications WHERE substr(applied_date, 1, 4) = ?").bind(selectedYear).all<{id:number; status:string}>()
    : await db.prepare("SELECT id, status FROM applications").all<{id:number; status:string}>();
  const history = await db.prepare("SELECT application_id as applicationId, status, changed_at as changedAt FROM application_status_history ORDER BY changed_at ASC, id ASC").all<{applicationId:number; status:string; changedAt:number}>();
  const byApplication = new Map<number, {status:string; changedAt:number}[]>();
  for (const entry of history.results) byApplication.set(entry.applicationId, [...(byApplication.get(entry.applicationId) ?? []), entry]);
  const hasReached = (entries:{status:string; changedAt:number}[], status:string) => entries.some(entry => entry.status === status);
  const reachedInterview = applications.results.filter(app => { const entries = byApplication.get(app.id) ?? []; return hasReached(entries, "Interview") || hasReached(entries, "Offer"); }).length;
  const reachedOffer = applications.results.filter(app => hasReached(byApplication.get(app.id) ?? [], "Offer")).length;
  const reachedAssessment = applications.results.filter(app => { const entries = byApplication.get(app.id) ?? []; return entries.some(entry => ["Assessment", "Interview", "Offer"].includes(entry.status)); }).length;
  const rejected = applications.results.filter(app => hasReached(byApplication.get(app.id) ?? [], "Rejected")).length;
  const interviewToOffer = applications.results.filter(app => { const entries = byApplication.get(app.id) ?? []; const interview = entries.find(entry => entry.status === "Interview"); return Boolean(interview && entries.some(entry => entry.status === "Offer" && entry.changedAt > interview.changedAt)); }).length;
  const applicationToRejected = rejected;
  const interviewToRejected = applications.results.filter(app => { const entries = byApplication.get(app.id) ?? []; const interview = entries.find(entry => entry.status === "Interview"); return Boolean(interview && entries.some(entry => entry.status === "Rejected" && entry.changedAt > interview.changedAt)); }).length;
  return { totalApplications: applications.results.length, reachedAssessment, reachedInterview, reachedOffer, rejected, transitions: { applicationToAssessment: reachedAssessment, applicationToInterview: reachedInterview, applicationToRejected, interviewToOffer, interviewToRejected } };
}




type BackupHistory = { status: string; changedAt: number; note?: string | null };
type BackupApplication = ApplicationPayload & { id: number; createdAt?: number; history?: BackupHistory[] };
type BackupPayload = { version: 1; applications: BackupApplication[] };
const backupStatuses = new Set(["Applied", "Phone screen", "Assessment", "Interview", "Offer", "Rejected"]);

const nullableText = (value: unknown) => typeof value === "string" && value.trim() ? value.trim() : null;
const validTimestamp = (value: unknown) => typeof value === "number" && Number.isFinite(value) && value > 0;

export async function exportApplicationBackup(db: D1Database) {
  await ensureApplicationsTable(db);
  const [applications, history] = await Promise.all([
    db.prepare("SELECT id, company, role, location, status, applied_date as appliedDate, salary, url, notes, contact_email as contactEmail, source, next_step as nextStep, next_action_date as nextActionDate, created_at as createdAt FROM applications ORDER BY applied_date DESC, id DESC").all<BackupApplication>(),
    db.prepare("SELECT application_id as applicationId, status, changed_at as changedAt, note FROM application_status_history ORDER BY application_id ASC, changed_at ASC, id ASC").all<BackupHistory & { applicationId: number }>(),
  ]);
  const histories = new Map<number, BackupHistory[]>();
  for (const entry of history.results) histories.set(entry.applicationId, [...(histories.get(entry.applicationId) ?? []), { status: entry.status, changedAt: entry.changedAt, note: entry.note }]);
  return { version: 1 as const, exportedAt: new Date().toISOString(), applications: applications.results.map(application => ({ ...application, history: histories.get(application.id) ?? [] })) };
}

function validateBackup(input: unknown): BackupPayload {
  if (!input || typeof input !== "object") throw new Error("Choose a valid Applyly JSON backup.");
  const backup = input as { version?: unknown; applications?: unknown };
  if (backup.version !== 1 || !Array.isArray(backup.applications)) throw new Error("Choose a valid Applyly JSON backup.");
  const ids = new Set<number>();
  const applications = backup.applications.map((entry, index) => {
    if (!entry || typeof entry !== "object") throw new Error(`Application ${index + 1} is invalid.`);
    const application = entry as BackupApplication;
    if (!Number.isInteger(application.id) || application.id <= 0 || ids.has(application.id)) throw new Error(`Application ${index + 1} has an invalid ID.`);
    ids.add(application.id);
    const company = nullableText(application.company);
    const role = nullableText(application.role);
    const appliedDate = typeof application.appliedDate === "string" ? application.appliedDate : "";
    const status = nullableText(application.status) ?? "Applied";
    if (!company || !role || !isValidAppliedDate(appliedDate) || !backupStatuses.has(status)) throw new Error(`Application ${index + 1} has invalid required data.`);
    const history = Array.isArray(application.history) ? application.history.map((item, historyIndex) => {
      if (!item || typeof item !== "object") throw new Error(`History item ${historyIndex + 1} is invalid.`);
      const record = item as BackupHistory;
      if (!backupStatuses.has(record.status) || !validTimestamp(record.changedAt)) throw new Error(`History item ${historyIndex + 1} is invalid.`);
      return { status: record.status, changedAt: record.changedAt, note: nullableText(record.note) };
    }) : [];
    if (history.some((entry, historyIndex) => historyIndex > 0 && entry.changedAt < history[historyIndex - 1].changedAt)) throw new Error(`Application ${index + 1} has out-of-order history.`);
    if (history.length && history[history.length - 1].status !== status) throw new Error(`Application ${index + 1} has a status that does not match its history.`);
    return { id: application.id, company, role, location: nullableText(application.location) ?? "Remote", status, appliedDate, salary: nullableText(application.salary), url: nullableText(application.url), notes: nullableText(application.notes), contactEmail: nullableText(application.contactEmail), source: nullableText(application.source), nextStep: nullableText(application.nextStep), nextActionDate: nullableText(application.nextActionDate), createdAt: validTimestamp(application.createdAt) ? application.createdAt : Date.now(), history };
  });
  return { version: 1, applications };
}

export async function importApplicationBackup(db: D1Database, input: unknown) {
  const backup = validateBackup(input);
  await ensureApplicationsTable(db);
  const statements = [db.prepare("DELETE FROM application_status_history"), db.prepare("DELETE FROM applications")];
  for (const application of backup.applications) {
    statements.push(db.prepare("INSERT INTO applications (id, company, role, location, status, applied_date, salary, url, notes, contact_email, source, next_step, next_action_date, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(application.id, application.company, application.role, application.location, application.status, application.appliedDate, application.salary, application.url, application.notes, application.contactEmail, application.source, application.nextStep, application.nextActionDate, application.createdAt));
    const history = application.history?.length ? application.history : [{ status: application.status, changedAt: application.createdAt ?? Date.now(), note: "Imported application" }];
    for (const entry of history) statements.push(db.prepare("INSERT INTO application_status_history (application_id, status, changed_at, note) VALUES (?, ?, ?, ?)").bind(application.id, entry.status, entry.changedAt, entry.note));
  }
  await db.batch(statements);
  return listApplications(db);
}
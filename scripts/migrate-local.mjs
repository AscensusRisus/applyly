import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const persistPath = process.env.APPLYLY_PERSIST_STATE_PATH || ".wrangler/state";
const wranglerPath = fileURLToPath(new URL("../node_modules/wrangler/bin/wrangler.js", import.meta.url));
const common = [wranglerPath, "d1"];
const local = ["DB", "--local", "--persist-to", persistPath, "--config", "wrangler.jsonc"];
const environment = { ...process.env, CI: "true" };

const legacyBaseline = [
  "CREATE TABLE IF NOT EXISTS d1_migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL)",
  "INSERT OR IGNORE INTO d1_migrations (name) SELECT '0000_thankful_virginia_dare.sql' WHERE EXISTS (SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'applications')",
  "INSERT OR IGNORE INTO d1_migrations (name) SELECT '0001_status_history.sql' WHERE EXISTS (SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'application_status_history')",
  "INSERT OR IGNORE INTO d1_migrations (name) SELECT '0002_application_details.sql' WHERE (SELECT COUNT(*) FROM pragma_table_info('applications') WHERE name IN ('contact_email', 'source', 'next_step', 'next_action_date')) = 4",
].join("; ");

const baseline = spawnSync(process.execPath, [...common, "execute", ...local, "--command", legacyBaseline], {
  cwd: process.cwd(),
  stdio: "inherit",
  windowsHide: true,
  env: environment,
});
if (baseline.status !== 0) process.exit(baseline.status ?? 1);

const migration = spawnSync(process.execPath, [...common, "migrations", "apply", ...local], {
  cwd: process.cwd(),
  stdio: "inherit",
  windowsHide: true,
  env: environment,
});
process.exit(migration.status ?? 1);

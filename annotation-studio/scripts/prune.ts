import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const databasePath = resolve(process.env.DATABASE_PATH?.trim() || ".data/app.db");
mkdirSync(dirname(databasePath), { recursive: true });
const db = new DatabaseSync(databasePath);
db.exec("PRAGMA busy_timeout = 5000");
const now = Date.now();
const sessions = db.prepare("DELETE FROM auth_sessions WHERE expires_at <= ?").run(new Date(now).toISOString());
const limits = db.prepare("DELETE FROM auth_rate_limits WHERE window_started_at < ?").run(now - 24 * 60 * 60 * 1000);
const retentionDays = Math.max(1, Number(process.env.AUDIT_RETENTION_DAYS ?? 365) || 365);
const audit = db.prepare("DELETE FROM audit_log WHERE created_at < ?").run(new Date(now - retentionDays * 24 * 60 * 60 * 1000).toISOString());
db.exec("PRAGMA wal_checkpoint(TRUNCATE)");
db.close();
console.log(JSON.stringify({ pruned: { sessions: Number(sessions.changes), rateLimits: Number(limits.changes), audit: Number(audit.changes) } }));
